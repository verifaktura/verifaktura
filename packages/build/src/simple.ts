import type { Invoice, InvoiceLine, Party, VatCategory } from "./model.js";

/** Pojednostavljena stavka za tipičan račun - jedna PDV stopa, bez popusta. */
export interface SimpleLine {
  name: string;
  quantity: string | number;
  unitPrice: string | number;
  /** Jedinica mjere po UN/ECE Rec 20; default "H87" (komad). */
  unitCode?: string;
  description?: string;
}

export interface SimpleInvoiceInput {
  id: string;
  issueDate: string;
  dueDate?: string;
  currency: string;
  seller: Party;
  buyer: Party;
  lines: SimpleLine[];
  /** Jedna PDV stopa za cijeli račun, npr. "17" ili "25". */
  vatRate: string | number;
  /** PDV kategorija; default "S" (standardna stopa). */
  vatCategory?: VatCategory;
  /** IBAN ili broj računa za plaćanje. */
  iban?: string;
  /** Poziv na broj. */
  paymentReference?: string;
  notes?: string[];
  /**
   * BT-24. Za hrvatski eRačun koristi `HR_CUSTOMIZATION_ID` iz
   * `@verifaktura/cius-hr`; tada su obavezni i `issueTime`, `profileId` i
   * `dueDate`, pa ih ovaj put traži zajedno s njim.
   */
  customizationId?: string;
  /**
   * HR-BT-2 - vrijeme izdavanja, `hh:mm:ss`. Obavezno za hrvatski eRačun
   * (HR-BR-2); bez njega dokument pada bez obzira na ostalo.
   */
  issueTime?: string;
  /** BT-23 - oznaka procesa. Za hrvatski eRačun P1–P12 ili `P99:<oznaka>` (HR-BR-34). */
  profileId?: string;
}

/**
 * Gradi model fakture za tipičan slučaj: jedna PDV stopa, bez popusta i
 * troškova na razini dokumenta.
 *
 * Ovo pokriva veliku većinu računa malih firmi i obrta. Za sve složenije
 * (više stopa, popusti, avansi, odobrenja) koristi puni `Invoice` model -
 * `simpleInvoice` je samo tanak sloj iznad njega, ne zaseban put.
 *
 * @example
 * ```ts
 * const xml = buildUbl(simpleInvoice({
 *   id: "2026-001", issueDate: "2026-07-29", currency: "BAM",
 *   seller, buyer, vatRate: "17",
 *   lines: [{ name: "Razvoj softvera", quantity: 10, unitPrice: "80.00" }],
 * }));
 * ```
 */
export function simpleInvoice(input: SimpleInvoiceInput): Invoice {
  const vatRate = String(input.vatRate);
  const vatCategory = input.vatCategory ?? "S";

  const lines: InvoiceLine[] = input.lines.map((l, i) => ({
    id: String(i + 1),
    name: l.name,
    description: l.description,
    quantity: String(l.quantity),
    unitCode: l.unitCode ?? "H87",
    unitPrice: String(l.unitPrice),
    vatCategory,
    vatRate,
  }));

  return {
    customizationId: input.customizationId,
    profileId: input.profileId,
    id: input.id,
    issueDate: input.issueDate,
    issueTime: input.issueTime,
    dueDate: input.dueDate,
    currency: input.currency,
    notes: input.notes,
    seller: input.seller,
    buyer: input.buyer,
    lines,
    paymentReference: input.paymentReference,
    paymentMeans: input.iban
      ? { code: "30", description: "Virman", accountId: input.iban }
      : undefined,
  };
}
