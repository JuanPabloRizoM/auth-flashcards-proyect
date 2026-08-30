/**
 * Cómo se leen los intervalos que produce el scheduler.
 *
 * Los botones de calificación anuncian cuándo volvería a aparecer la carta. La unidad se
 * elige por magnitud, como en cualquier aplicación de repetición espaciada: minutos para
 * los pasos de aprendizaje, horas para lo que cae dentro del día, días, meses y años para
 * el repaso. Nunca se escribe un intervalo a mano: el valor viene siempre del preview real.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function plural(value: number, singular: string, many: string): string {
  return value === 1 ? `1 ${singular}` : `${value} ${many}`;
}

/** Redondeo a un decimal, sin arrastrar el `.0`. */
function compact(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Intervalo legible: `<1 min`, `10 min`, `3 h`, `2 días`, `1,5 meses`, `2,3 años`.
 *
 * Los intervalos por debajo del minuto existen —FSRS puede programar segundos— y se
 * anuncian como "menos de un minuto" en vez de como "0 min", que se leería como "ya".
 */
export function formatSchedulingInterval(millis: number): string {
  if (!Number.isFinite(millis) || millis < 0) return '—';
  if (millis < MINUTE) return '<1 min';
  if (millis < HOUR) return `${Math.round(millis / MINUTE)} min`;
  if (millis < DAY) return `${Math.round(millis / HOUR)} h`;
  if (millis < MONTH) return plural(Math.round(millis / DAY), 'día', 'días');
  if (millis < YEAR) return `${compact(millis / MONTH).replace('.', ',')} meses`;
  return `${compact(millis / YEAR).replace('.', ',')} años`;
}

/** Intervalo expresado en días, para las estadísticas de intervalos. */
export function formatIntervalDays(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return '—';
  if (days < 1) return '<1 día';
  if (days < 30) return plural(Math.round(days), 'día', 'días');
  if (days < 365) return `${compact(days / 30).replace('.', ',')} meses`;
  return `${compact(days / 365).replace('.', ',')} años`;
}
