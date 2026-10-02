// Weights and dimensions (tracker 2.7). Shared by the browser and the server.
//
// The database keeps ONE canonical unit — pounds and inches — which is what every existing
// record already holds (weight_lbs, total_weight_lbs, dimensions_json in inches). Forms default
// to kg/cm with a lb/in toggle and convert at the edges; nothing is stored in kg or cm.

export type UnitSystem = 'metric' | 'imperial';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const weightUnit = (system: UnitSystem) => (system === 'metric' ? 'kg' : 'lb');
export const lengthUnit = (system: UnitSystem) => (system === 'metric' ? 'cm' : 'in');

// Canonical values are kept to 3 decimals so kg -> lb -> kg round-trips to what was typed.
const canonical = (n: number) => Math.round(n * 1000) / 1000;

export const weightToDisplay = (lbs: number, system: UnitSystem) => (system === 'metric' ? lbs * KG_PER_LB : lbs);
export const weightFromDisplay = (value: number, system: UnitSystem) => canonical(system === 'metric' ? value / KG_PER_LB : value);
export const lengthToDisplay = (inches: number, system: UnitSystem) => (system === 'metric' ? inches * CM_PER_IN : inches);
export const lengthFromDisplay = (value: number, system: UnitSystem) => canonical(system === 'metric' ? value / CM_PER_IN : value);

// Rounds for display: at most `digits` decimals, trailing zeros dropped (22.0 -> "22").
export function roundForDisplay(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '';
  return String(Math.round(value * 10 ** digits) / 10 ** digits);
}

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : null;
};

/** "10.5 kg" / "23.1 lb" from a canonical pound value; '' when missing. */
export function formatWeight(lbs: unknown, system: UnitSystem, digits = 1): string {
  const n = toNumber(lbs);
  if (n === null) return '';
  return `${Number(roundForDisplay(weightToDisplay(n, system), digits)).toLocaleString('en-US')} ${weightUnit(system)}`;
}

/** "30 cm" / "12 in" from a canonical inch value; '' when missing. */
export function formatLength(inches: unknown, system: UnitSystem, digits = 1): string {
  const n = toNumber(inches);
  if (n === null) return '';
  return `${roundForDisplay(lengthToDisplay(n, system), digits)} ${lengthUnit(system)}`;
}

/** "30 × 30 × 30 cm" from canonical inch dimensions; '' when none are set. */
export function formatDimensions(dims: { length?: unknown; width?: unknown; height?: unknown } | null | undefined, system: UnitSystem): string {
  if (!dims) return '';
  // 0 or missing = that side wasn't given
  const parts = [dims.length, dims.width, dims.height].map(toNumber).map((p) => (p !== null && p > 0 ? p : null));
  if (parts.every((p) => p === null)) return '';
  return `${parts.map((p) => (p === null ? '—' : roundForDisplay(lengthToDisplay(p, system), 1))).join(' × ')} ${lengthUnit(system)}`;
}

export const KM_PER_MILE = 1.609344;

/** "5,012 km" / "3,115 miles" from a distance in miles (route distances are computed in miles). */
export function formatDistance(miles: unknown, system: UnitSystem): string {
  const n = toNumber(miles);
  if (n === null) return '';
  const value = Math.round(system === 'metric' ? n * KM_PER_MILE : n);
  return `${value.toLocaleString('en-US')} ${system === 'metric' ? 'km' : 'miles'}`;
}

/** "10 kg (22 lb)" — for documents and stored text, readable whichever system the reader uses. */
export function formatWeightBoth(lbs: unknown): string {
  const metric = formatWeight(lbs, 'metric');
  return metric ? `${metric} (${formatWeight(lbs, 'imperial')})` : '';
}
