import { localDayOf } from './time';

/**
 * Formato de las cifras que se enseñan.
 *
 * Vive aparte del motor: el motor produce números exactos y aquí se decide cómo se leen.
 * Ninguna de estas funciones inventa un valor cuando no lo hay: lo desconocido se rinde
 * como un guion, nunca como cero (docs/PRODUCT.md, 2026-08-23).
 */

/** Marcador de lo que no se sabe. Un cero afirmaría algo falso. */
export const UNKNOWN = '—';

/** Duración legible: `1 h 12 min`, `18 min`, `45 s`. */
export function formatDuration(millis: number | null): string {
  if (millis === null || !Number.isFinite(millis) || millis < 0) return UNKNOWN;

  const totalSeconds = Math.round(millis / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** Segundos por tarjeta: `27.4 s`. */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return UNKNOWN;
  return `${seconds.toFixed(1)} s`;
}

/**
 * Número con separador de millares en español.
 *
 * Se agrupa a mano y no con `Intl`: el soporte de `Intl` depende del ICU que traiga cada
 * plataforma, y una cifra no puede leerse distinto en el PDF de web y en el de un móvil.
 *
 * Convención del español: el punto separa los millares a partir de cinco dígitos. Un año o
 * un número de cuatro cifras se escriben seguidos (1000, no 1.000).
 */
export function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return UNKNOWN;

  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  if (digits.length <= 4) return `${sign}${digits}`;

  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Promedios con un decimal: `1.2`. */
export function formatAverage(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return UNKNOWN;
  return value.toFixed(1);
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return UNKNOWN;
  return `${value.toFixed(1).replace(/\.0$/, '')} %`;
}

const monthNames = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Fecha larga a partir de una clave de día: `23 de agosto de 2026`.
 *
 * Se formatea a partir del texto `YYYY-MM-DD`, sin construir un `Date`: el día ya está
 * decidido y volver a pasarlo por una zona horaria solo podría estropearlo.
 */
export function formatDayLong(day: string): string {
  const year = day.slice(0, 4);
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  const name = monthNames[month - 1];
  if (!name || Number.isNaN(date)) return day;
  return `${date} de ${name} de ${year}`;
}

/** Fecha corta para ejes y celdas: `23 ago`. */
export function formatDayShort(day: string): string {
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  const name = monthNames[month - 1];
  if (!name || Number.isNaN(date)) return day;
  return `${date} ${name.slice(0, 3)}`;
}

/** Fecha larga de un instante. Para `trackedSince` y la fecha de generación del reporte. */
export function formatInstantLong(epochMs: number | null): string {
  if (epochMs === null || !Number.isFinite(epochMs)) return UNKNOWN;
  return formatDayLong(localDayOf(epochMs));
}

/** Hora del eje horario: `07`. */
export function formatHour(hour: number): string {
  return String(hour).padStart(2, '0');
}

export const originLabels = {
  manual: 'Manual',
  csv: 'CSV',
  xlsx: 'XLSX',
  markdown: 'Markdown',
  desconocido: 'Origen desconocido / anterior al tracking',
} as const;
