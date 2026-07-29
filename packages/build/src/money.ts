/**
 * Aritmetika novca nad cijelim brojevima (najmanje jedinice).
 *
 * Float se NE koristi: 0.1 + 0.2 !== 0.3 bi značilo da izlaz pada na BR-CO-15
 * ili BR-CO-17 u validatoru. Sve se drži kao bigint u stotinkama i tek se na
 * kraju formatira na dvije decimale (EN 16931 traži max 2 - BR-DEC-*).
 */

const SCALE = 100n; // 2 decimale - iznosi
const QTY_SCALE = 1_000_000n; // 6 decimala - količine i jedinične cijene

/**
 * Normalizuje broj u kanonski `xs:decimal` oblik.
 *
 * Ulaz smije koristiti zarez kao decimalni separator (uobičajeno u regiji), ali
 * XML ga NE smije sadržavati - Saxon na "10,50" baca XError i ruši proces.
 * Zato se svaka vrijednost koja ide u dokument prvo provuče kroz ovo.
 *
 * @throws ako vrijednost nije broj
 */
export function normalizeDecimal(value: string | number): string {
  const s = String(value).trim().replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Neispravan broj: "${value}"`);
  }
  return s.startsWith("+") ? s.slice(1) : s;
}

/** Parsira vrijednost u cijele jedinice date skale, uz half-up zaokruživanje. */
function parseScaled(value: string | number, scale: bigint): bigint {
  const s = normalizeDecimal(value);
  const digits = String(scale).length - 1;
  const neg = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const padded = (frac + "0".repeat(digits + 1)).slice(0, digits + 1);
  let units = BigInt(whole) * scale + BigInt(padded.slice(0, digits) || "0");
  if (Number(padded[digits]) >= 5) units += 1n;
  return neg ? -units : units;
}

/**
 * Parsira "1234.56" u 123456n (stotinke). Prihvata i zarez kao separator.
 *
 * Koristi se za IZNOSE, koje EN 16931 ionako ograničava na dvije decimale
 * (BR-DEC-*). Za količine i jedinične cijene koristi `multiply`, koji čuva
 * veću preciznost.
 */
export function parseAmount(value: string | number): bigint {
  return parseScaled(value, SCALE);
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

/**
 * Množi količinu i jediničnu cijenu, vraća iznos u stotinkama.
 *
 * Količina i cijena se drže na šest decimala, a tek se rezultat zaokružuje na
 * dvije. Raniji pristup je oba operanda prvo zaokruživao na dvije decimale, pa
 * je 0.001 × 1000.00 davalo 0.00 umjesto 1.00 - tiho pogrešan iznos na stavci,
 * koji korisnik ne može primijetiti bez ručnog računanja.
 */
export function multiply(quantity: string | number, unitPrice: string | number): bigint {
  const qty = parseScaled(quantity, QTY_SCALE);
  const price = parseScaled(unitPrice, QTY_SCALE);
  const denominator = QTY_SCALE * QTY_SCALE / SCALE;
  const numerator = qty * price;
  const q = numerator / denominator;
  const r = numerator % denominator;
  const half = denominator / 2n;
  const rAbs = r < 0n ? -r : r;
  if (rAbs >= half) return q + (numerator < 0n ? -1n : 1n);
  return q;
}
