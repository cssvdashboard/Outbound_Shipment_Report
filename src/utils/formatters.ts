export function formatTT(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

export function formatWeight(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
}

export function formatExcelDate(serialOrDate: any): string {
  if (!serialOrDate) return '-';
  
  // If it's an Excel serial date number (e.g. 46212.506944444445)
  const num = typeof serialOrDate === 'number' ? serialOrDate : parseFloat(String(serialOrDate));
  if (!isNaN(num) && num > 30000 && num < 70000) {
    // Excel date epoch starts on 1899-12-30
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const msPerDay = 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + num * msPerDay);
    
    if (!isNaN(date.getTime())) {
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      const y = date.getUTCFullYear();
      return `${m}/${d}/${y}`;
    }
  }

  // If it's a date string matching YYYY-MM-DD or YYYY/MM/DD
  if (typeof serialOrDate === 'string') {
    const match = serialOrDate.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      const d = match[3].padStart(2, '0');
      return `${m}/${d}/${y}`;
    }
  }

  // Fallback for other date strings or Date objects
  try {
    const d = new Date(serialOrDate);
    if (!isNaN(d.getTime())) {
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const y = d.getFullYear();
      return `${m}/${day}/${y}`;
    }
  } catch (e) {
    // ignore
  }

  return String(serialOrDate).slice(0, 16);
}
