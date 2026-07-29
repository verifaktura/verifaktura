/**
 * Aritmetika novca nad cijelim brojevima (najmanje jedinice).
 *
 * Float se NE koristi: 0.1 + 0.2 !== 0.3 bi značilo da izlaz pada na BR-CO-15
 * ili BR-CO-17 u validatoru. Sve se drži kao bigint u stotinkama i tek se na
 * kraju formatira na dvije decimale (EN 16931 traži max 2 - BR-DEC-*).
 */

const SCALE = 100n; // 2 decimale

/** Parsira "1234.56" u 123456n. Prihvata i zarez kao decimalni separator. */
export function parseAmount(value: string | number): bigint {
  const s = String(value).trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Neispravan iznos: "${value}"`);
  }
  const neg = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  // zaokruživanje na 2 decimale, half-up
  const padded = (frac + "000").slice(0, 3);
  let cents = BigInt(whole) * SCALE + BigInt(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1n;
  return neg ? -cents : cents;
}

/** Formatira 123456n u "1234.56". */
export function formatAmount(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = abs / SCALE;
  const frac = abs % SCALE;
  return `${neg ? "-" : ""}${whole}.${frac.toString().padStart(2, "0")}`;
}

/** Zbraja iznose date kao stringovi. */
export function sum(...values: (string | undefined)[]): bigint {
  return values.reduce<bigint>((acc, v) => acc + (v ? parseAmount(v) : 0n), 0n);
}

/**
 * Množi iznos procentualnom stopom uz half-up zaokruživanje na 2 decimale.
 * Primjer: 800 (=8.00) × 17% -> 136 (=1.36), tačno kako traži BR-CO-17.
 */
export function applyRate(baseCents: bigint, ratePercent: string): bigint {
  const rate = parseAmount(ratePercent); // stopa u stotinkama procenta
  const numerator = baseCents * rate;
  const denominator = 100n * SCALE;
  const q = numerator / denominator;
  const r = numerator % denominator;
  // half-up
  return r * 2n >= denominator ? q + 1n : q;
}

/** Množi količinu i cijenu. Količina može imati više decimala od iznosa. */
export function multiply(quantity: string, unitPrice: string): bigint {
  const qty = parseAmount(quantity);
  const price = parseAmount(unitPrice);
  const numerator = qty * price;
  const q = numerator / SCALE;
  const r = numerator % SCALE;
  return r * 2n >= SCALE ? q + 1n : q;
}
