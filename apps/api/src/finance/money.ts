/**
 * Convert a decimal money string (e.g. "12.34", "-1.5") to integer minor units.
 * Uses banker's-safe string parsing rather than floating point multiplication.
 */
export function amountToMinorUnits(amount: string): number {
  const trimmed = amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);

  if (!match) {
    throw new Error(`Invalid monetary amount: ${amount}`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const whole = match[2] ?? "0";
  const fractionRaw = match[3] ?? "";
  const fraction = (fractionRaw + "00").slice(0, 2);
  const minor = Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction, 10);

  return sign * minor;
}

/** Format minor units for display, e.g. -1234 + "EUR" → "-12.34". */
export function formatMinorUnits(amountMinor: number, currency: string): string {
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction} ${currency}`;
}
