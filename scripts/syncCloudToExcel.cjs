const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const PROJECT_ID = 'outbound-shipment-report';
const API_KEY = 'AIzaSyCvR0lYrn8BE2TyTc3SwxFz0Pgtnql9pyw';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/shipment_edits`;

const EXCEL_TARGETS = [
  {
    name: 'July Final Draft',
    filePath: path.resolve(__dirname, '../July Final Draft.xlsx'),
    preferredSheet: 'Data',
    awbKeys: ['awb', 'airway bill', 'tracking number', 'track number']
  },
  {
    name: 'August Final Draft',
    filePath: path.resolve(__dirname, '../August Final Draft.xlsx'),
    preferredSheet: 'Sheet1',
    awbKeys: ['track number', 'awb', 'airway bill', 'tracking number']
  },
  {
    name: 'September Final Draft',
    filePath: path.resolve(__dirname, '../September Final Draft.xlsx'),
    preferredSheet: 'Sheet1',
    awbKeys: ['awb', 'track number', 'airway bill', 'tracking number']
  }
];

function findColumnIndex(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const cleanHeader = headers[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const name of possibleNames) {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanHeader === cleanName) {
        return i;
      }
    }
  }
  return -1;
}

function parseFirestoreField(field) {
  if (!field) return '';
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return String(field.integerValue);
  if (field.doubleValue !== undefined) return String(field.doubleValue);
  if (field.booleanValue !== undefined) return String(field.booleanValue);
  if (field.timestampValue !== undefined) return field.timestampValue;
  return '';
}

async function fetchAllCloudEdits() {
  console.log('📡 Fetching cloud edits from Firebase Firestore...');
  const edits = [];
  let pageToken = '';

  do {
    const url = new URL(FIRESTORE_BASE_URL);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      throw new Error(`Firebase API responded with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        const awb = doc.name.split('/').pop();
        const fields = doc.fields || {};
        const parsed = {
          awb: String(parseFirestoreField(fields.awb) || awb).trim(),
          transitDelay: fields.transitDelay ? parseFirestoreField(fields.transitDelay) : undefined,
          clearanceDelay: fields.clearanceDelay ? parseFirestoreField(fields.clearanceDelay) : undefined,
          destinationDelay: fields.destinationDelay ? parseFirestoreField(fields.destinationDelay) : undefined,
          weekendDelay: fields.weekendDelay ? parseFirestoreField(fields.weekendDelay) : undefined,
          remarks: fields.remarks ? parseFirestoreField(fields.remarks) : undefined,
          finalResolution: fields.finalResolution ? parseFirestoreField(fields.finalResolution) : undefined,
          lastEditor: fields.lastEditor ? parseFirestoreField(fields.lastEditor) : undefined
        };
        edits.push(parsed);
      }
    }

    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return edits;
}

async function syncCloudToExcel() {
  try {
    const edits = await fetchAllCloudEdits();

    if (edits.length === 0) {
      console.log('ℹ️ No cloud edits found in Firebase Firestore.');
      console.log('   All local Excel files are already in sync!');
      return;
    }

    console.log(`📥 Found ${edits.length} cloud edit(s) in Firebase Firestore.`);

    const editsMap = new Map();
    for (const e of edits) {
      if (e.awb) editsMap.set(e.awb.toLowerCase(), e);
    }

    let totalUpdatedCount = 0;

    for (const target of EXCEL_TARGETS) {
      if (!fs.existsSync(target.filePath)) {
        console.warn(`File not found: ${target.filePath}`);
        continue;
      }

      console.log(`Processing ${target.name}...`);
      const fileBuffer = fs.readFileSync(target.filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.Sheets[target.preferredSheet]
        ? target.preferredSheet
        : workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet || !worksheet['!ref']) continue;

      const range = XLSX.utils.decode_range(worksheet['!ref']);

      // 1. Read header row
      const headers = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        headers.push(cell ? String(cell.v).trim() : '');
      }

      // 2. Find column indices
      const awbColIdx = findColumnIndex(headers, target.awbKeys);
      if (awbColIdx === -1) {
        console.warn(`Could not find AWB column in ${target.name}`);
        continue;
      }

      const transitColIdx = findColumnIndex(headers, ['TRANSIT DELAY', 'Transit Delay', 'Delay in Transit']);
      const clearanceColIdx = findColumnIndex(headers, ['CLEARANCE DELAY', 'Clearance Delay', 'Customs Delay', 'Clearanace Delay']);
      const destinationColIdx = findColumnIndex(headers, ['DESTIANTION DELAY', 'DESTINATION DELAY', 'Destination Delay', 'Delivery Delay']);
      const weekendColIdx = findColumnIndex(headers, ['WEEKEND DELAY', 'Weekend Delay']);
      const remarksColIdx = findColumnIndex(headers, ['REMARKS', 'Remarks', 'Comment']);
      const resolutionColIdx = findColumnIndex(headers, ['FINAL RESOLUTION', 'Final Resolution', 'Status', 'Resolution']);

      let fileUpdatedRows = 0;

      // 3. Scan rows and update
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: awbColIdx })];
        if (!cell || !cell.v) continue;

        const cleanAwb = String(cell.v).trim().toLowerCase();
        const edit = editsMap.get(cleanAwb);
        if (edit) {
          const setCellValue = (cIdx, val) => {
            if (cIdx !== -1 && val !== undefined) {
              const addr = XLSX.utils.encode_cell({ r: R, c: cIdx });
              worksheet[addr] = { t: 's', v: String(val) };
            }
          };

          if (edit.transitDelay !== undefined) setCellValue(transitColIdx, edit.transitDelay);
          if (edit.clearanceDelay !== undefined) setCellValue(clearanceColIdx, edit.clearanceDelay);
          if (edit.destinationDelay !== undefined) setCellValue(destinationColIdx, edit.destinationDelay);
          if (edit.weekendDelay !== undefined) setCellValue(weekendColIdx, edit.weekendDelay);
          if (edit.remarks !== undefined) setCellValue(remarksColIdx, edit.remarks);
          if (edit.finalResolution !== undefined) setCellValue(resolutionColIdx, edit.finalResolution);

          fileUpdatedRows++;
          totalUpdatedCount++;
        }
      }

      if (fileUpdatedRows > 0) {
        try {
          const outBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          fs.writeFileSync(target.filePath, outBuffer);
          console.log(`✅ Updated ${fileUpdatedRows} shipment(s) in ${path.basename(target.filePath)}`);
        } catch (err) {
          if (err.code === 'EBUSY') {
            console.error(`❌ Error: ${path.basename(target.filePath)} is currently open in Excel! Please close it and rerun.`);
          } else {
            console.error(`❌ Failed to save ${path.basename(target.filePath)}:`, err.message);
          }
        }
      } else {
        console.log(`   (No matching AWBs found in ${target.name})`);
      }
    }

    console.log(`\n🎉 Sync complete! Total updated records in Excel: ${totalUpdatedCount}`);
    
    // Refresh JSON cache files
    console.log('\n🔄 Refreshing local defaultData.json cache files...');
    require('./updateDefaultData.cjs');

  } catch (err) {
    console.error('❌ Cloud to Excel sync failed:', err.message);
  }
}

syncCloudToExcel();
