import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as xlsxModule from 'xlsx';
import { ServerShipment } from '../utils/excelParser.js';

const XLSX = (xlsxModule as any).default || xlsxModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExcelTarget {
  name: string;
  filePath: string;
  preferredSheet: string;
  awbKeys: string[];
}

const EXCEL_TARGETS: ExcelTarget[] = [
  {
    name: 'July Final Draft',
    filePath: path.resolve(__dirname, '../../July Final Draft.xlsx'),
    preferredSheet: 'Data',
    awbKeys: ['awb', 'airway bill', 'tracking number', 'track number']
  },
  {
    name: 'August Final Draft',
    filePath: path.resolve(__dirname, '../../August Final Draft.xlsx'),
    preferredSheet: 'Sheet1',
    awbKeys: ['track number', 'awb', 'airway bill', 'tracking number']
  },
  {
    name: 'September Final Draft',
    filePath: path.resolve(__dirname, '../../September Final Draft.xlsx'),
    preferredSheet: 'Sheet1',
    awbKeys: ['awb', 'track number', 'airway bill', 'tracking number']
  }
];

function findColumnIndex(headers: string[], possibleNames: string[]): number {
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

export async function syncShipmentToSourceExcel(
  awb: string,
  updates: Partial<ServerShipment>
): Promise<{ success: boolean; filename?: string; error?: string }> {
  const cleanAwb = String(awb).trim();
  if (!cleanAwb) return { success: false, error: 'Empty AWB' };

  for (const target of EXCEL_TARGETS) {
    if (!fs.existsSync(target.filePath)) continue;

    try {
      const fileBuffer = fs.readFileSync(target.filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.Sheets[target.preferredSheet]
        ? target.preferredSheet
        : workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet || !worksheet['!ref']) continue;

      const range = XLSX.utils.decode_range(worksheet['!ref']);

      // 1. Read header row
      const headers: string[] = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        headers.push(cell ? String(cell.v).trim() : '');
      }

      // 2. Find AWB Column
      const awbColIdx = findColumnIndex(headers, target.awbKeys);
      if (awbColIdx === -1) continue;

      // 3. Scan rows for matching AWB
      let targetRow = -1;
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: awbColIdx })];
        if (cell && String(cell.v).trim() === cleanAwb) {
          targetRow = R;
          break;
        }
      }

      if (targetRow === -1) {
        // Not in this file, check next
        continue;
      }

      // 4. Map columns to update
      const transitColIdx = findColumnIndex(headers, ['TRANSIT DELAY', 'Transit Delay', 'Delay in Transit']);
      const clearanceColIdx = findColumnIndex(headers, ['CLEARANCE DELAY', 'Clearance Delay', 'Customs Delay', 'Clearanace Delay']);
      const destinationColIdx = findColumnIndex(headers, ['DESTIANTION DELAY', 'DESTINATION DELAY', 'Destination Delay', 'Delivery Delay']);
      const weekendColIdx = findColumnIndex(headers, ['WEEKEND DELAY', 'Weekend Delay']);
      const remarksColIdx = findColumnIndex(headers, ['REMARKS', 'Remarks', 'Comment']);
      const resolutionColIdx = findColumnIndex(headers, ['FINAL RESOLUTION', 'Final Resolution', 'Status', 'Resolution']);

      const setCellValue = (cIdx: number, val: string | undefined) => {
        if (cIdx !== -1 && val !== undefined) {
          const addr = XLSX.utils.encode_cell({ r: targetRow, c: cIdx });
          worksheet[addr] = { t: 's', v: String(val) };
        }
      };

      if (updates.transitDelay !== undefined) setCellValue(transitColIdx, updates.transitDelay);
      if (updates.clearanceDelay !== undefined) setCellValue(clearanceColIdx, updates.clearanceDelay);
      if (updates.destinationDelay !== undefined) setCellValue(destinationColIdx, updates.destinationDelay);
      if (updates.weekendDelay !== undefined) setCellValue(weekendColIdx, updates.weekendDelay);
      if (updates.remarks !== undefined) setCellValue(remarksColIdx, updates.remarks);
      if (updates.finalResolution !== undefined) setCellValue(resolutionColIdx, updates.finalResolution);

      // 5. Write back to disk
      const outBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(target.filePath, outBuffer);
      console.log(`[ExcelSync] ✅ Successfully updated AWB ${cleanAwb} directly in ${path.basename(target.filePath)}`);
      return { success: true, filename: path.basename(target.filePath) };
    } catch (err: any) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        console.warn(`[ExcelSync] ⚠️ ${path.basename(target.filePath)} is currently open/locked in Excel. Data saved in app database.`);
        return {
          success: false,
          filename: path.basename(target.filePath),
          error: `File ${path.basename(target.filePath)} is open in Excel and locked by Windows. Please close it in Excel to allow background disk sync.`
        };
      }
      console.error(`[ExcelSync] Error updating ${path.basename(target.filePath)}:`, err);
    }
  }

  return { success: false, error: `AWB ${cleanAwb} was not found in July, August, or September master Excel files.` };
}
