const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function normalizeClearanceDelay(val) {
  if (!val) return '';
  const trimmed = String(val).trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'unable to locate consignee' || lower === 'consignee untraceable') {
    return 'Unable To Locate Consignee';
  }
  if (lower === 'held for duty tax') {
    return 'Held for Duty Tax';
  }
  if (lower === 'refused by consignee') {
    return 'Refused by Consignee';
  }
  if (lower === 'description insufficient' || lower === 'insufficient description') {
    return 'Insufficient Description';
  }
  if (lower === 'nfrbk' || lower === 'nfbrk') {
    return 'NFBRK';
  }
  if (lower === 'cspc form' || lower === 'cpsc required') {
    return 'CPSC Required';
  }
  if (lower === 'eori number' || lower === 'eori required') {
    return 'EORI Required';
  }
  if (lower === 'restricted item' || lower === 'restricted commodity') {
    return 'Restricted Commodity';
  }

  return trimmed;
}

function normalizeDestinationDelay(val) {
  if (!val) return '';
  const trimmed = String(val).trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'missing pod' || lower === 'dispute pod') {
    return 'Dispute POD';
  }
  if (lower === 'refused by consignee') {
    return 'Refused by Consignee';
  }

  return trimmed;
}

function normalizeTransitDelay(val) {
  if (!val) return '';
  const trimmed = String(val).trim();
  const lower = trimmed.toLowerCase();

  // Remove "Flight space offload delay" / "Flight Space Offload Dealy"
  if (lower.includes('offload')) {
    return '';
  }

  return trimmed;
}

const FILES_TO_FIX = [
  { name: 'July Final Draft.xlsx', sheet: 'Data' },
  { name: 'August Final Draft.xlsx', sheet: 'Sheet1' },
  { name: 'September Final Draft.xlsx', sheet: 'Sheet1' }
];

console.log('🚀 Fixing delay categories in Excel spreadsheets...');

for (const item of FILES_TO_FIX) {
  const filePath = path.resolve(__dirname, '..', item.name);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping missing file: ${item.name}`);
    continue;
  }

  console.log(`\nProcessing ${item.name} [${item.sheet}]...`);
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[item.sheet] || workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet || !sheet['!ref']) {
    console.log(`No valid sheet data found in ${item.name}`);
    continue;
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);

  // Find column headers
  let transitCol = -1;
  let clearanceCol = -1;
  let destDelayCol = -1;
  let awbCol = -1;

  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
    if (!cell) continue;
    const h = String(cell.v).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (h.includes('transitdelay')) transitCol = C;
    if (h.includes('clearance') && h.includes('delay')) clearanceCol = C;
    if ((h.includes('destiantion') || h.includes('destination')) && h.includes('delay')) destDelayCol = C;
    if (h === 'awb' || h === 'airwaybill' || h === 'tracknumber' || h === 'trackingnumber') awbCol = C;
  }

  console.log(`Columns found - Transit: ${transitCol}, Clearance: ${clearanceCol}, Destination Delay: ${destDelayCol}, AWB: ${awbCol}`);

  let changedCount = 0;

  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    const awbCell = awbCol !== -1 ? sheet[XLSX.utils.encode_cell({ r: R, c: awbCol })] : null;
    const awb = awbCell ? String(awbCell.v).trim() : '';

    // 1. Transit Delay
    if (transitCol !== -1) {
      const addr = XLSX.utils.encode_cell({ r: R, c: transitCol });
      const cell = sheet[addr];
      if (cell && cell.v) {
        const original = String(cell.v).trim();
        const normalized = normalizeTransitDelay(original);
        if (original !== normalized) {
          if (normalized === '') {
            delete sheet[addr];
          } else {
            sheet[addr] = { t: 's', v: normalized };
          }
          console.log(`  [Row ${R + 1} | AWB ${awb}] Transit Delay: "${original}" -> "${normalized}"`);
          changedCount++;
        }
      }
    }

    // 2. Clearance Delay
    if (clearanceCol !== -1) {
      const addr = XLSX.utils.encode_cell({ r: R, c: clearanceCol });
      const cell = sheet[addr];
      if (cell && cell.v) {
        const original = String(cell.v).trim();

        // Special fix: AWB 876476036687 had US Transit Delay in Clearance Delay column
        if (original === 'US Transit Delay') {
          delete sheet[addr];
          if (transitCol !== -1) {
            const transitAddr = XLSX.utils.encode_cell({ r: R, c: transitCol });
            sheet[transitAddr] = { t: 's', v: 'US Transit Delay' };
          }
          console.log(`  [Row ${R + 1} | AWB ${awb}] Moved "US Transit Delay" from Clearance to Transit Delay`);
          changedCount++;
        } else {
          const normalized = normalizeClearanceDelay(original);
          if (original !== normalized) {
            sheet[addr] = { t: 's', v: normalized };
            console.log(`  [Row ${R + 1} | AWB ${awb}] Clearance Delay: "${original}" -> "${normalized}"`);
            changedCount++;
          }
        }
      }
    }

    // 3. Destination Delay
    if (destDelayCol !== -1) {
      const addr = XLSX.utils.encode_cell({ r: R, c: destDelayCol });
      const cell = sheet[addr];
      if (cell && cell.v) {
        const original = String(cell.v).trim();
        const normalized = normalizeDestinationDelay(original);
        if (original !== normalized) {
          sheet[addr] = { t: 's', v: normalized };
          console.log(`  [Row ${R + 1} | AWB ${awb}] Destination Delay: "${original}" -> "${normalized}"`);
          changedCount++;
        }
      }
    }
  }

  if (changedCount > 0) {
    const outBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(filePath, outBuffer);
    console.log(`✅ Saved ${changedCount} fixes into ${item.name}`);
  } else {
    console.log(`No changes needed for ${item.name}`);
  }
}

console.log('\n🎉 Finished updating Excel files!');
