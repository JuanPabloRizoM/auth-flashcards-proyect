import type { StatsPeriod } from './types';

/**
 * Aritmética de días locales y fronteras de periodo.
 *
 * Una clave de día es `YYYY-MM-DD` y representa el día del calendario de quien estudió.
 * Se calcula una sola vez, al registrar el evento, y a partir de ahí se trata como texto:
 * comparar, sumar y restar días nunca vuelve a pasar por una zona horaria, así que ni el
 * horario de verano ni la `TZ` con la que se ejecuten los tests pueden cambiar el
 * resultado. El orden lexicográfico de `YYYY-MM-DD` coincide con el cronológico, que es
 * lo que hace que las comparaciones de frontera sean triviales y exactas.
 */

/** Días naturales que cubre cada periodo. `null` es "todo el historial". */
const periodLengths: Record<StatsPeriod, number | null> = {
  '1m': 30,
  '3m': 90,
  '1y': 365,
  all: null,
};

export const periodLabels: Record<StatsPeriod, string> = {
  '1m': 'Último mes',
  '3m': 'Últimos 3 meses',
  '1y': 'Último año',
  all: 'Todo el historial',
};

/** Etiquetas cortas para los controles de la pantalla. */
export const periodShortLabels: Record<StatsPeriod, string> = {
  '1m': '1 mes',
  '3m': '3 meses',
  '1y': '1 año',
  all: 'Todo',
};

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** Día local de un instante, según la zona horaria del dispositivo en ese momento. */
export function localDayOf(epochMs: number): string {
  const date = new Date(epochMs);
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Hora local 0..23 de un instante. */
export function localHourOf(epochMs: number): number {
  return new Date(epochMs).getHours();
}

/** Mes al que pertenece un día, `YYYY-MM`. Es la clave de partición del historial. */
export function monthOfDay(day: string): string {
  return day.slice(0, 7);
}

/**
 * Convierte una clave de día en un instante manejable.
 *
 * Se interpreta en UTC a propósito: aquí la clave ya no representa un instante real sino
 * una casilla del calendario, y hacer la aritmética en UTC evita que un día con cambio de
 * hora dure 23 o 25 horas y descuadre el conteo.
 */
function dayToUtc(day: string): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  return Date.UTC(year, month - 1, date);
}

function utcToDay(millis: number): string {
  const date = new Date(millis);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

const DAY_MS = 86_400_000;

/** Suma (o resta, con `delta` negativo) días naturales a una clave de día. */
export function addDays(day: string, delta: number): string {
  return utcToDay(dayToUtc(day) + delta * DAY_MS);
}

/** Días naturales de `from` a `to`, ambos incluidos. Negativo si `to` es anterior. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtc(to) - dayToUtc(from)) / DAY_MS);
}

/** Todos los días de `from` a `to`, ambos incluidos. Vacío si el rango está invertido. */
export function enumerateDays(from: string, to: string): string[] {
  const total = daysBetween(from, to);
  if (total < 0) return [];
  const days: string[] = [];
  for (let offset = 0; offset <= total; offset += 1) {
    days.push(addDays(from, offset));
  }
  return days;
}

export function isValidDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && utcToDay(dayToUtc(day)) === day;
}

export type PeriodRange = {
  /** Primer día incluido. `null` en "todo el historial": no hay frontera inferior. */
  fromDay: string | null;
  /** Último día incluido: hoy. */
  toDay: string;
  /** Días que cubre el periodo, para los promedios. `null` en "todo el historial". */
  days: number | null;
};

/**
 * Ventana de un periodo terminada en hoy.
 *
 * "1 mes" son los 30 días que terminan hoy, hoy incluido: el primer día de la ventana es
 * hoy menos 29. Se define en días naturales y no en meses de calendario para que la
 * frontera sea exacta y no dependa de si el mes tenía 28, 30 o 31 días.
 */
export function periodRange(period: StatsPeriod, today: string): PeriodRange {
  const length = periodLengths[period];
  if (length === null) {
    return { fromDay: null, toDay: today, days: null };
  }
  return { fromDay: addDays(today, -(length - 1)), toDay: today, days: length };
}

/** ¿Cae este día dentro de la ventana? */
export function dayInRange(day: string, range: PeriodRange): boolean {
  if (day > range.toDay) return false;
  return range.fromDay === null || day >= range.fromDay;
}

/**
 * Día de la semana de una clave de día: 0 domingo … 6 sábado.
 *
 * Se calcula en UTC, igual que el resto de la aritmética, para que la columna del
 * calendario no dependa de la zona horaria de quien mira el informe.
 */
export function weekdayOfDay(day: string): number {
  return new Date(dayToUtc(day)).getUTCDay();
}
