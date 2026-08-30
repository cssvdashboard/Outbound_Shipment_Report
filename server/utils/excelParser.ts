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
      const awb = String(normalizeKey(row, ['AWB', 'Airway Bill', 'Tracking Number', 'Tracking No']) || '').trim();
      const mawb = String(normalizeKey(row, ['MAWB', 'Master AWB']) || '').trim();
      const destination = String(normalizeKey(row, ['DESTINATION', 'Dest', 'Country Code', 'Country', 'Dest Country']) || '').trim().toUpperCase();
      const rampId = String(normalizeKey(row, ['Ramp ID', 'RampId', 'Ramp']) || '').trim();
      const destLocCd = String(normalizeKey(row, ['Dest Loc Cd', 'DestLocCd', 'Dest Location']) || '').trim();
      const customer = String(normalizeKey(row, ['CUSTOMER', 'Customer Name', 'Client']) || '').trim();
      const shprName = String(normalizeKey(row, ['SHPR NAME', 'Shipper Name', 'Shipper', 'SHPR']) || '').trim();
      const recipient = String(normalizeKey(row, ['RECIPIENT', 'Receiver', 'Consignee']) || '').trim();
      
      const pkgCountRaw = normalizeKey(row, ['PKG COUNT', 'Pkg Count', 'Pieces', 'Qty']);
      const pkgCount = typeof pkgCountRaw === 'number' ? pkgCountRaw : (parseInt(String(pkgCountRaw), 10) || 1);
      
      const weightRaw = normalizeKey(row, ['WEIGHT', 'Weight (kg)', 'Gross Wt', 'Wt']);
      const weight = typeof weightRaw === 'number' ? weightRaw : (parseFloat(String(weightRaw)) || 0);
      
      const city = String(normalizeKey(row, ['CITY', 'Dest City', 'Destination City']) || '').trim();
      const description = String(normalizeKey(row, ['DESCRIPTION', 'Goods Description', 'Commodity']) || '').trim();
      const pickup = normalizeKey(row, ['PICKUP', 'Pickup Date', 'Pickup Date Time']);
      const pod = normalizeKey(row, ['POD', 'POD Date', 'Delivery Date']);
      
      const ttRaw = normalizeKey(row, ['TT', 'Transit Time', 'Transit Time (Days)', 'TT (Days)']);
      let tt = typeof ttRaw === 'number' ? ttRaw : (parseFloat(String(ttRaw)) || 0);
      if (isNaN(tt) || tt < 0) tt = 0;

      let ttRange = String(normalizeKey(row, ['TT Range', 'TTRange', 'Delivery Timeline']) || '').trim();
      if (!ttRange) {
        ttRange = tt <= 5 ? 'Within 4-5 Days' : 'More Than 5 Days';
      }

      const transitDelay = String(normalizeKey(row, ['TRANSIT DELAY', 'Transit Delay', 'Delay in Transit']) || '').trim();
      const clearanceDelay = String(normalizeKey(row, ['CLEARANCE DELAY', 'Clearance Delay', 'Customs Delay']) || '').trim();
      const destinationDelay = String(normalizeKey(row, ['DESTIANTION DELAY', 'DESTINATION DELAY', 'Destination Delay', 'Delivery Delay']) || '').trim();
      const weekendDelay = String(normalizeKey(row, ['WEEKEND DELAY', 'Weekend Delay']) || '').trim();
      
      let finalResolution = String(normalizeKey(row, ['FINAL RESOLUTION', 'Final Resolution', 'Status', 'Resolution']) || '').trim();
      if (!finalResolution) finalResolution = 'Delivered';

      const remarks = String(normalizeKey(row, ['REMARKS', 'Remarks', 'Comment']) || '').trim();

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
        remarks
      };
    }).filter(s => s.awb || s.customer || s.shprName);

    return { shipments };
  } catch (err: any) {
    return { shipments: [], error: err?.message || 'Failed to parse Excel file' };
  }
}
