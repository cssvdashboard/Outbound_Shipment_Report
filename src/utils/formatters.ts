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
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      });
    }
  }

  // If it's a date string
  try {
    const d = new Date(serialOrDate);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      });
    }
  } catch (e) {
    // ignore
  }

  return String(serialOrDate).slice(0, 16);
}
