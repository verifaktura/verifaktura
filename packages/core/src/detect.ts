import { NS } from "./namespaces.js";
import type { DocumentSummary, Syntax } from "./types.js";

const { ublInvoice: UBL_INV, ublCreditNote: UBL_CN, cii: CII, cbc: CBC, cac: CAC, ram: RAM } = NS;

/**
 * Tip CII dokumenta iz `ExchangedDocument/TypeCode`.
 *
 * Ranije je svaki CII dokument prijavljivan kao "invoice", pa su odobrenja
 * (šifra 381) bila pogrešno označena u sažetku izvještaja.
 */
function ciiDocumentType(root: Element): DocumentSummary["type"] {
  const code = root.getElementsByTagNameNS(RAM, "TypeCode")[0]?.textContent?.trim();
  if (code === "381") return "creditNote";
  return code ? "invoice" : "unknown";
}

/** Prepoznaje sintaksu i tip dokumenta iz korijenskog elementa. */
export function detectSyntax(doc: Document): { syntax: Syntax; type: DocumentSummary["type"] } {
  const root = doc.documentElement;
  const ns = root?.namespaceURI ?? "";
  if (ns === UBL_INV) return { syntax: "ubl", type: "invoice" };
  if (ns === UBL_CN) return { syntax: "ubl", type: "creditNote" };
  if (ns === CII) return { syntax: "cii", type: ciiDocumentType(root) };
  throw new Error(`Nepoznata sintaksa dokumenta (namespace: ${ns || "nema"})`);
}

/** Vrati tekst direktnog djeteta korijena - NE bilo kojeg potomka.
 *  Bitno: cbc:ID se pojavljuje i unutar cac:PartyIdentification, PaymentMeans itd.,
 *  pa bi pretraga po cijelom dokumentu vratila pogrešnu vrijednost. */
function childText(root: Element, ns: string, name: string): string | undefined {
  const kids = root.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i] as Element;
    if (n.nodeType === 1 && n.namespaceURI === ns && n.localName === name) {
      return n.textContent?.trim() || undefined;
    }
  }
  return undefined;
}

/** Naziv stranke iz cac:AccountingSupplierParty / cac:AccountingCustomerParty. */
function partyName(root: Element, wrapper: string): string | undefined {
  const w = root.getElementsByTagNameNS(CAC, wrapper)[0];
  if (!w) return undefined;
  const pn = w.getElementsByTagNameNS(CAC, "PartyName")[0];
  const fromPartyName = pn?.textContent?.trim();
  if (fromPartyName) return fromPartyName;
  const legal = w.getElementsByTagNameNS(CAC, "PartyLegalEntity")[0];
  return legal?.getElementsByTagNameNS(CBC, "RegistrationName")[0]?.textContent?.trim() || undefined;
}

/**
 * PDV identifikator stranke (BT-31 / BT-48).
 *
 * Bira se PartyTaxScheme čija je shema stvarno "VAT". Ranije se uzimao prvi po
 * redu, pa je porezni broj (BT-32) mogao završiti u sažetku kao PDV ID - dvije
 * različite stvari koje se u dokumentu razlikuju samo po TaxScheme/ID.
 */
function partyVat(root: Element, wrapper: string): string | undefined {
  const w = root.getElementsByTagNameNS(CAC, wrapper)[0];
  if (!w) return undefined;
  const schemes = w.getElementsByTagNameNS(CAC, "PartyTaxScheme");
  for (let i = 0; i < schemes.length; i++) {
    const scheme = schemes[i] as Element;
    const id = scheme
      .getElementsByTagNameNS(CAC, "TaxScheme")[0]
      ?.getElementsByTagNameNS(CBC, "ID")[0]
      ?.textContent?.trim()
      .toUpperCase();
    if (id === "VAT") {
      return scheme.getElementsByTagNameNS(CBC, "CompanyID")[0]?.textContent?.trim() || undefined;
    }
  }
  return undefined;
}

/** Izvlači sažetak dokumenta za zaglavlje izvještaja (UBL; CII se dodaje u v0.2). */
export function summarizeUbl(doc: Document): Omit<DocumentSummary, "syntax" | "type"> {
  const root = doc.documentElement as unknown as Element;
  const supplierName = partyName(root, "AccountingSupplierParty");
  const customerName = partyName(root, "AccountingCustomerParty");
  const supplierVat = partyVat(root, "AccountingSupplierParty");
  const customerVat = partyVat(root, "AccountingCustomerParty");
  const totals = root.getElementsByTagNameNS(CAC, "LegalMonetaryTotal")[0];

  return {
    customizationId: childText(root, CBC, "CustomizationID"),
    profileId: childText(root, CBC, "ProfileID"),
    id: childText(root, CBC, "ID"),
    issueDate: childText(root, CBC, "IssueDate"),
    currency: childText(root, CBC, "DocumentCurrencyCode"),
    supplier: supplierName || supplierVat ? { name: supplierName, vatId: supplierVat } : undefined,
    customer: customerName || customerVat ? { name: customerName, vatId: customerVat } : undefined,
    payableAmount:
      totals?.getElementsByTagNameNS(CBC, "PayableAmount")[0]?.textContent?.trim() || undefined,
  };
}
