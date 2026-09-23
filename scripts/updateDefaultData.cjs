const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function normalizeKey(obj, possibleKeys) {
  const keys = Object.keys(obj);
  for (const pk of possibleKeys) {
    const cleanedPk = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanedPk);
    if (matchedKey && obj[matchedKey] !== undefined) {
      return obj[matchedKey];
    }
  }
  return '';
}

function parseFile(filePath, defaultSheetName) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }
  console.log(`Reading ${filePath}...`);
  const workbook = XLSX.readFile(filePath);
  let targetSheetName = defaultSheetName || workbook.SheetNames.find(s => s.toLowerCase() === 'data') || workbook.SheetNames[0];
  
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
  if (!worksheet) return [];

  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  console.log(`Parsed ${rawRows.length} raw rows from ${targetSheetName} in ${filePath}`);

  return rawRows.map(row => {
    const awb = String(normalizeKey(row, ['AWB', 'Airway Bill', 'Tracking Number', 'Tracking No', 'Track Number']) || '').trim();
    const mawb = String(normalizeKey(row, ['MAWB', 'Master AWB']) || '').trim();
    const destination = String(normalizeKey(row, ['DESTINATION', 'Dest', 'Country Code', 'Country', 'Dest Country']) || '').trim().toUpperCase();
    const rampId = String(normalizeKey(row, ['Ramp ID', 'RampId', 'Ramp', 'Dest Ramp']) || '').trim();
    const destLocCd = String(normalizeKey(row, ['Dest Loc Cd', 'DestLocCd', 'Dest Location', 'Dest Loc Id', 'Dest Loc']) || '').trim();
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

    let ttRange;
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
    const clearanceDelay = String(normalizeKey(row, ['CLEARANCE DELAY', 'Clearance Delay', 'Customs Delay']) || '').trim();
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
}

const julyShipments = parseFile(path.resolve(__dirname, '../July Final Draft.xlsx'), 'Data');
const augustShipments = parseFile(path.resolve(__dirname, '../August Final Draft.xlsx'), 'Sheet1');

const combined = [...julyShipments, ...augustShipments];
console.log(`Total combined shipments: ${combined.length}`);

const withSips = combined.filter(s => s.sips).length;
const withCommit = combined.filter(s => s.commitDate).length;
const withDexOrStat = combined.filter(s => s.dex01 || s.stat41).length;
console.log(`With SIPS: ${withSips}, With Commit: ${withCommit}, With DEX/STAT: ${withDexOrStat}`);

const publicPath = path.resolve(__dirname, '../public/defaultData.json');
const srcDataPath = path.resolve(__dirname, '../src/data/defaultData.json');
const distDataPath = path.resolve(__dirname, '../dist/defaultData.json');

fs.writeFileSync(publicPath, JSON.stringify(combined));
console.log(`Wrote ${combined.length} records to ${publicPath}`);

fs.writeFileSync(srcDataPath, JSON.stringify(combined));
console.log(`Wrote ${combined.length} records to ${srcDataPath}`);

if (fs.existsSync(path.resolve(__dirname, '../dist'))) {
  fs.writeFileSync(distDataPath, JSON.stringify(combined));
  console.log(`Wrote ${combined.length} records to ${distDataPath}`);
}

