import * as XLSX from 'xlsx';

export interface ServerShipment {
  awb: string;
  mawb?: string;
  destination: string;
  rampId?: string;
  destLocCd?: string;
  customer: string;
  shprName: string;
  recipient?: string;
  pkgCount?: number;
  weight?: number;
  city?: string;
  description?: string;
  pickup?: string | number;
  pod?: string | number;
  tt: number;
  ttRange: string;
  transitDelay?: string;
  clearanceDelay?: string;
  destinationDelay?: string;
  weekendDelay?: string;
  finalResolution: string;
  remarks?: string;
  shipmentType?: string;
  isAgent?: boolean;
  sips?: string | number;
  commitDate?: string | number;
  dex01?: string | number;
  stat41?: string | number;
}

export function parseExcelBuffer(buffer: Buffer): { shipments: ServerShipment[]; error?: string } {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Find target sheet
    let targetSheetName = workbook.SheetNames.find(s => s.toLowerCase() === 'data') || workbook.SheetNames[0];
    
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (sheet && sheet['!ref']) {
        const range = XLSX.utils.decode_range(sheet['!ref']);
        if (range.e.r > 500) {
          targetSheetName = name;
          break;
        }
      }
    }

    const worksheet = workbook.Sheets[targetSheetName];
    if (!worksheet) {
      return { shipments: [], error: 'No valid data worksheet found in workbook.' };
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    if (!rawRows || rawRows.length === 0) {
      return { shipments: [], error: 'The selected worksheet contains no data rows.' };
    }

    const normalizeKey = (obj: Record<string, any>, possibleKeys: string[]): any => {
      const keys = Object.keys(obj);
      for (const pk of possibleKeys) {
        const cleanedPk = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanedPk);
        if (matchedKey && obj[matchedKey] !== undefined) {
          return obj[matchedKey];
        }
      }
      return '';
    };

    const shipments: ServerShipment[] = rawRows.map((row) => {
      const awb = String(normalizeKey(row, ['AWB', 'Airway Bill', 'Tracking Number', 'Tracking No', 'Track Number', 'Tracking']) || '').trim();
      const mawb = String(normalizeKey(row, ['MAWB', 'Master AWB', 'Flight Master']) || '').trim();
      const destination = String(normalizeKey(row, ['DESTINATION', 'Dest', 'Country Code', 'Country', 'Dest Country']) || '').trim().toUpperCase();
      const rampId = String(normalizeKey(row, ['Ramp ID', 'RampId', 'Ramp', 'Dest Ramp']) || '').trim();
      const destLocCd = String(normalizeKey(row, ['Dest Loc Cd', 'DestLocCd', 'Dest Location', 'Dest Loc Id', 'Dest Loc ID']) || '').trim();
      const customer = String(normalizeKey(row, ['CUSTOMER', 'Customer Name', 'Client']) || '').trim();
      const shprName = String(normalizeKey(row, ['SHPR NAME', 'Shipper Name', 'Shipper', 'SHPR']) || '').trim();
      const recipient = String(normalizeKey(row, ['RECIPIENT', 'Receiver', 'Consignee', 'Recipient Name And Company']) || '').trim();
      
      const pkgCountRaw = normalizeKey(row, ['PKG COUNT', 'Pkg Count', 'Pieces', 'Qty']);
      const pkgCount = typeof pkgCountRaw === 'number' ? pkgCountRaw : (parseInt(String(pkgCountRaw), 10) || 1);
      
      const weightRaw = normalizeKey(row, ['WEIGHT', 'Weight (kg)', 'Gross Wt', 'Wt', 'Shpmt Weight in Kg', 'Weight in Kg']);
      const weight = typeof weightRaw === 'number' ? weightRaw : (parseFloat(String(weightRaw)) || 0);
      
      const city = String(normalizeKey(row, ['CITY', 'Dest City', 'Destination City', 'Dest City Name']) || '').trim();
      const description = String(normalizeKey(row, ['DESCRIPTION', 'Goods Description', 'Commodity', 'Manifested Description']) || '').trim();
      const pickup = normalizeKey(row, ['PICKUP', 'Pickup Date', 'Pickup Date Time']);
      const pod = normalizeKey(row, ['POD', 'POD Date', 'Delivery Date']);
      
      const ttRaw = normalizeKey(row, ['TT', 'Transit Time', 'Transit Time (Days)', 'TT (Days)']);
      let tt = typeof ttRaw === 'number' ? ttRaw : (parseFloat(String(ttRaw)) || 0);
      if (isNaN(tt) || tt < 0) tt = 0;

      // Do NOT take information from Excel's 'TT Range' column; derive performance breakdown strictly from TT
      let ttRange: string;
      if (tt <= 0) {
        ttRange = 'Undelivered';
      } else if (tt <= 4) {
        ttRange = 'Day 1–4';
      } else if (tt <= 5) {
        ttRange = 'Day 5';
      } else if (tt <= 6) {
        ttRange = 'Day 6';
      } else if (tt <= 7) {
        ttRange = 'Day 7';
      } else {
        ttRange = 'Day 8+';
      }

      const transitDelay = String(normalizeKey(row, ['TRANSIT DELAY', 'Transit Delay', 'Delay in Transit']) || '').trim();
      const clearanceDelay = String(normalizeKey(row, ['CLEARANCE DELAY', 'Clearance Delay', 'Customs Delay', 'Clearanace Delay']) || '').trim();
      const destinationDelay = String(normalizeKey(row, ['DESTIANTION DELAY', 'DESTINATION DELAY', 'Destination Delay', 'Delivery Delay']) || '').trim();
      const weekendDelay = String(normalizeKey(row, ['WEEKEND DELAY', 'Weekend Delay']) || '').trim();
      
      let finalResolution = String(normalizeKey(row, ['FINAL RESOLUTION', 'Final Resolution', 'Status', 'Resolution']) || '').trim();
      if (!finalResolution) finalResolution = 'Delivered';

      const remarks = String(normalizeKey(row, ['REMARKS', 'Remarks', 'Comment']) || '').trim();

      const rawType = String(normalizeKey(row, ['Shipment Type', 'ShipmentType', 'Type', 'PP/CC', 'Payment Type']) || '').trim().toUpperCase();
      let shipmentType = 'PP';
      if (rawType === 'CC') shipmentType = 'CC';
      else if (rawType === 'IPD') shipmentType = 'IPD';
      else if (rawType === 'PP') shipmentType = 'PP';
      else if (rawType) shipmentType = rawType;
      const isAgent = /agent/i.test(customer);

      const sips = normalizeKey(row, ['SIPS', 'Sips Date', 'Sips']);
      const commitDate = normalizeKey(row, ['COMMIT TIME', 'Commit Date', 'Commit Time', 'CommitDate', 'Commit']);
      const dex01 = normalizeKey(row, ['DEX 01', 'DEX01', 'Dex 01', 'Dex01', 'DEX_01']);
      const stat41 = normalizeKey(row, ['STAT 41', 'STAT41', 'Stat 41', 'Stat41', 'STAT_41']);

      return {
        awb,
        mawb,
        destination,
        rampId,
        destLocCd,
        customer,
        shprName,
        recipient,
        pkgCount,
        weight,
        city,
        description,
        pickup,
        pod,
        tt,
        ttRange,
        transitDelay,
        clearanceDelay,
        destinationDelay,
        weekendDelay,
        finalResolution,
        remarks,
        shipmentType,
        isAgent,
        sips,
        commitDate,
        dex01,
        stat41
      };
    }).filter(s => s.awb || s.customer || s.shprName);

    return { shipments };
  } catch (err: any) {
    return { shipments: [], error: err?.message || 'Failed to parse Excel file' };
  }
}
