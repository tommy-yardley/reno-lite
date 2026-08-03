import { INCH_PER_METER } from "../constants";
export { INCH_PER_METER };

function gcdInt(a, b) {
  return b ? gcdInt(b, a % b) : a;
}

export function formatFeetInchesFraction(totalInches, denom = 16) {
  const sign = totalInches < 0 ? "-" : "";
  totalInches = Math.abs(totalInches);
  let feet = Math.floor(totalInches / 12);
  let remInches = totalInches - feet * 12;
  let wholeIn = Math.floor(remInches);
  let frac = remInches - wholeIn;
  let numerator = Math.round(frac * denom);
  const den = denom;
  if (numerator === den) {
    wholeIn += 1;
    numerator = 0;
  }
  if (wholeIn === 12) {
    feet += 1;
    wholeIn = 0;
  }
  let fracStr = "";
  if (numerator > 0) {
    const g = gcdInt(numerator, den);
    fracStr = ` ${numerator / g}/${den / g}`;
  }
  return `${sign}${feet}'-${wholeIn}${fracStr}"`;
}

export function lengthToDisplay(inches, unit, fraction = false) {
  if (unit === "imperial") return fraction ? formatFeetInchesFraction(inches) : `${(inches / 12).toFixed(2)} ft`;
  return `${(inches / INCH_PER_METER).toFixed(2)} m`;
}

export function areaToDisplay(sqInches, unit) {
  if (unit === "imperial") return `${(sqInches / 144).toFixed(1)} sq ft`;
  return `${(sqInches / (INCH_PER_METER * INCH_PER_METER)).toFixed(1)} sq m`;
}

export function parseLengthInput(value, unit) {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return unit === "imperial" ? n * 12 : n * INCH_PER_METER;
}
