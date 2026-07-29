import type { DocumentSummary, Syntax } from "./types.js";

const UBL_INV = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
const UBL_CN = "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2";
const CII = "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100";
const CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
const CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";

/** Prepoznaje sintaksu i tip dokumenta iz korijenskog elementa. */
export function detectSyntax(doc: Document): { syntax: Syntax; type: DocumentSummary["type"] } {
  const root = doc.documentElement;
  const ns = root?.namespaceURI ?? "";
  if (ns === UBL_INV) return { syntax: "ubl", type: "invoice" };
  if (ns === UBL_CN) return { syntax: "ubl", type: "creditNote" };
  if (ns === CII) return { syntax: "cii", type: "invoice" };
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

/** PDV/VAT ID stranke (cac:PartyTaxScheme/cbc:CompanyID). */
function partyVat(root: Element, wrapper: string): string | undefined {
  const w = root.getElementsByTagNameNS(CAC, wrapper)[0];
  const ts = w?.getElementsByTagNameNS(CAC, "PartyTaxScheme")[0];
  return ts?.getElementsByTagNameNS(CBC, "CompanyID")[0]?.textContent?.trim() || undefined;
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
