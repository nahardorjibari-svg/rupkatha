/**
 * Dhaka Time & Date Utilities
 * Rupkatha Apparels Ltd.
 * Time zone: Asia/Dhaka (UTC+6)
 */

export function getDhakaDateString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // YYYY-MM-DD
}

export function getDhakaYearMonth(date = new Date()): { year: number; month: number } {
  const dateStr = getDhakaDateString(date);
  const [y, m] = dateStr.split('-').map(Number);
  return { year: y, month: m };
}

export function formatDhakaTime12(isoOrDateString?: string | null): string {
  if (!isoOrDateString) return '-';
  const d = new Date(isoOrDateString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDhakaDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00+06:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDhakaDateBangla(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00+06:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('bn-BD', {
    timeZone: 'Asia/Dhaka',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function minutesToHhMm(minutes?: number | null): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateWorkingHoursBetween(startIso?: string | null, endIso?: string | null): string {
  if (!startIso || !endIso) return '-';
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return '-';
  const diffMinutes = Math.round((end - start) / (1000 * 60));
  return minutesToHhMm(diffMinutes);
}

/**
 * Calculates service length from joining date to today: "X years Y months Z days"
 */
export function calculateServiceLength(joiningDateStr?: string | null): string {
  if (!joiningDateStr) return '-';
  const start = new Date(joiningDateStr);
  if (isNaN(start.getTime())) return '-';
  
  // Use today in Dhaka
  const dhakaStr = getDhakaDateString();
  const now = new Date(dhakaStr);
  if (now < start) return '0 days';

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);

  return parts.join(' ');
}
