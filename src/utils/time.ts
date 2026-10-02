export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const overlaps = (aStart: string, aDur: number, bStart: string, bDur: number) =>
  toMin(aStart) < toMin(bStart) + bDur && toMin(bStart) < toMin(aStart) + aDur;

export const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayStr = () => fmtDate(new Date());
