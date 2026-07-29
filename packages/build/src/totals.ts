import { applyRate, formatAmount, multiply, parseAmount, sum } from "./money.js";
import type { Invoice, InvoiceLine, Totals, VatBreakdownEntry } from "./model.js";

/** Neto iznos stavke: količina × cijena − popusti + troškovi (BT-131). */
export function lineNetAmount(line: InvoiceLine): bigint {
  if (line.netAmount !== undefined) return parseAmount(line.netAmount);
  const base = multiply(line.quantity, line.unitPrice);
  const allowances = sum(...(line.allowances ?? []).map((a) => a.amount));
  const charges = sum(...(line.charges ?? []).map((c) => c.amount));
  return base - allowances + charges;
}

/** Ključ grupisanja u rekapitulaciji PDV-a: kategorija + stopa (BG-23). */
function vatKey(category: string, rate: string): string {
  return `${category}|${formatAmount(parseAmount(rate))}`;
}

/**
 * Računa rekapitulaciju PDV-a (BG-23) iz stavki, popusta i troškova.
 *
 * Pravila koja ovo mora zadovoljiti:
 *  - BR-CO-18: najmanje jedna grupa
 *  - BR-S-08 i srodna: osnovica = Σ stavke + Σ troškovi − Σ popusti, po kategoriji i stopi
 *  - BR-CO-17: iznos PDV-a = osnovica × stopa / 100, zaokruženo na 2 decimale
 *  - BR-AE-09 / BR-G-09 / BR-IC-09 / BR-O-09: iznos PDV-a je 0 za te kategorije
 */
export function computeVatBreakdown(invoice: Invoice): VatBreakdownEntry[] {
  const buckets = new Map<string, { category: string; rate: string; taxable: bigint }>();

  const add = (category: string, rate: string, amount: bigint): void => {
    const key = vatKey(category, rate);
    const hit = buckets.get(key);
    if (hit) hit.taxable += amount;
    else buckets.set(key, { category, rate, taxable: amount });
  };

  for (const line of invoice.lines) {
    add(line.vatCategory, line.vatRate, lineNetAmount(line));
  }
  for (const a of invoice.allowances ?? []) {
    add(a.vatCategory, a.vatRate, -parseAmount(a.amount));
  }
  for (const c of invoice.charges ?? []) {
    add(c.vatCategory, c.vatRate, parseAmount(c.amount));
  }

  /** Kategorije kod kojih je iznos PDV-a nula bez obzira na stopu. */
  const ZERO_TAX = new Set(["AE", "K", "G", "O"]);

  return [...buckets.values()].map((b) => ({
    category: b.category as VatBreakdownEntry["category"],
    rate: formatAmount(parseAmount(b.rate)),
    taxableAmount: formatAmount(b.taxable),
    taxAmount: formatAmount(ZERO_TAX.has(b.category) ? 0n : applyRate(b.taxable, b.rate)),
  }));
}

/**
 * Računa ukupne iznose (BG-22).
 *
 * BR-CO-10: BT-106 = Σ BT-131
 * BR-CO-13: BT-109 = Σ BT-131 − BT-107 + BT-108
 * BR-CO-14: BT-110 = Σ BT-117
 * BR-CO-15: BT-112 = BT-109 + BT-110
 * BR-CO-16: BT-115 = BT-112 − BT-113 + BT-114
 */
export function computeTotals(invoice: Invoice, breakdown: VatBreakdownEntry[]): Totals {
  const lineNet = invoice.lines.reduce<bigint>((a, l) => a + lineNetAmount(l), 0n);
  const allowances = sum(...(invoice.allowances ?? []).map((a) => a.amount));
  const charges = sum(...(invoice.charges ?? []).map((c) => c.amount));
  const net = lineNet - allowances + charges;
  const vat = breakdown.reduce<bigint>((a, e) => a + parseAmount(e.taxAmount), 0n);
  const gross = net + vat;
  const paid = invoice.totals?.paidAmount ? parseAmount(invoice.totals.paidAmount) : 0n;
  const rounding = invoice.totals?.roundingAmount ? parseAmount(invoice.totals.roundingAmount) : 0n;

  return {
    lineNetTotal: formatAmount(lineNet),
    allowanceTotal: allowances !== 0n ? formatAmount(allowances) : undefined,
    chargeTotal: charges !== 0n ? formatAmount(charges) : undefined,
    netTotal: formatAmount(net),
    vatTotal: formatAmount(vat),
    grossTotal: formatAmount(gross),
    paidAmount: paid !== 0n ? formatAmount(paid) : undefined,
    roundingAmount: rounding !== 0n ? formatAmount(rounding) : undefined,
    payableAmount: formatAmount(gross - paid + rounding),
  };
}
