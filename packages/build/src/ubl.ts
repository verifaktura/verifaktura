import { XmlWriter } from "./xml.js";
import { computeTotals, computeVatBreakdown } from "./totals.js";
import { formatAmount, normalizeDecimal, parseAmount } from "./money.js";
import { lineNetAmount } from "./totals.js";
import type {
  Address,
  Contact,
  DocumentCharge,
  Invoice,
  InvoiceLine,
  Party,
  VatBreakdownEntry,
} from "./model.js";

const NS = {
  inv: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  cn: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
};

const DEFAULT_CUSTOMIZATION = "urn:cen.eu:en16931:2017";
const DEFAULT_PROFILE = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";

/**
 * Broj u obliku koji XML smije nositi.
 *
 * Ulaz smije koristiti zarez (parseAmount ga tolerira), ali serijalizacija ga
 * ne smije proslijediti - Saxon na "10,50" baca XError i ruši proces umjesto da
 * vrati nalaz. Vrijednosti su se ranije pisale doslovno, pa se ono što je
 * ulazno prihvaćeno razilazilo s onim što je izračunato.
 */
function num(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : normalizeDecimal(value);
}

function writeAddress(w: XmlWriter, a: Address): void {
  w.block("cac:PostalAddress", () => {
    w.leaf("cbc:StreetName", a.street);
    w.leaf("cbc:AdditionalStreetName", a.additionalStreet);
    w.leaf("cbc:CityName", a.city);
    w.leaf("cbc:PostalZone", a.postalCode);
    w.leaf("cbc:CountrySubentity", a.subdivision);
    w.block("cac:Country", () => w.leaf("cbc:IdentificationCode", a.country));
  });
}

function writeContact(w: XmlWriter, tag: string, c: Contact): void {
  w.block(tag, () => {
    w.leaf("cbc:ID", c.id);
    w.leaf("cbc:Name", c.name);
    w.leaf("cbc:Telephone", c.phone);
    w.leaf("cbc:ElectronicMail", c.email);
  });
}

function writeParty(
  w: XmlWriter,
  wrapper: string,
  p: Party,
  sellerContactOutsideParty = false,
): void {
  const isSupplier = wrapper === "cac:AccountingSupplierParty";
  const asSellerContact = isSupplier && sellerContactOutsideParty;
  w.block(wrapper, () => {
    w.block("cac:Party", () => {
      if (p.electronicAddress) {
        w.leaf("cbc:EndpointID", p.electronicAddress.value, {
          schemeID: p.electronicAddress.scheme,
        });
      }
      if (p.legalId) {
        w.block("cac:PartyIdentification", () =>
          w.leaf("cbc:ID", p.legalId, { schemeID: p.legalIdScheme }),
        );
      }
      w.block("cac:PartyName", () => w.leaf("cbc:Name", p.tradingName ?? p.name));
      writeAddress(w, p.address);
      if (p.vatId) {
        w.block("cac:PartyTaxScheme", () => {
          w.leaf("cbc:CompanyID", p.vatId);
          w.block("cac:TaxScheme", () => w.leaf("cbc:ID", "VAT"));
        });
      }
      if (p.taxRegistrationId) {
        w.block("cac:PartyTaxScheme", () => {
          w.leaf("cbc:CompanyID", p.taxRegistrationId);
          w.block("cac:TaxScheme", () => w.leaf("cbc:ID", "!VAT"));
        });
      }
      w.block("cac:PartyLegalEntity", () => {
        w.leaf("cbc:RegistrationName", p.name);
        w.leaf("cbc:CompanyID", p.legalId, { schemeID: p.legalIdScheme });
      });
      // BG-6 se po EN 16931 mapira na cac:Party/cac:Contact. Hrvatski CIUS
      // umjesto toga traži cac:SellerContact izvan Party (HR-BR-37, HR-BR-9),
      // što CEN-ovo UBL-CR-200 prijavljuje. Zato se ta lokacija koristi samo
      // kad dokument stvarno ide po hrvatskoj specifikaciji - inače bi svaki
      // običan EN 16931 račun s kontaktom nosio nepotrebno upozorenje.
      if (p.contact && !asSellerContact) writeContact(w, "cac:Contact", p.contact);
    });
    if (p.contact && asSellerContact) writeContact(w, "cac:SellerContact", p.contact);
  });
}

function writeDocumentCharge(
  w: XmlWriter,
  c: DocumentCharge,
  isCharge: boolean,
  currency: string,
): void {
  w.block("cac:AllowanceCharge", () => {
    w.leaf("cbc:ChargeIndicator", isCharge ? "true" : "false");
    w.leaf(isCharge ? "cbc:AllowanceChargeReasonCode" : "cbc:AllowanceChargeReasonCode", c.reasonCode);
    w.leaf("cbc:AllowanceChargeReason", c.reason);
    w.leaf("cbc:Amount", num(c.amount), { currencyID: currency });
    w.leaf("cbc:BaseAmount", num(c.baseAmount), { currencyID: currency });
    w.block("cac:TaxCategory", () => {
      w.leaf("cbc:ID", c.vatCategory);
      // Kategorija "O" ne smije nositi stopu (BR-O-05/06/07)
      if (c.vatCategory !== "O") w.leaf("cbc:Percent", num(c.vatRate));
      w.block("cac:TaxScheme", () => w.leaf("cbc:ID", "VAT"));
    });
  });
}

function writeVatBreakdown(
  w: XmlWriter,
  entries: VatBreakdownEntry[],
  currency: string,
): void {
  const total = entries.reduce((a, e) => a + parseAmount(e.taxAmount), 0n);
  w.block("cac:TaxTotal", () => {
    w.leaf("cbc:TaxAmount", formatAmount(total), { currencyID: currency });
    for (const e of entries) {
      w.block("cac:TaxSubtotal", () => {
        w.leaf("cbc:TaxableAmount", num(e.taxableAmount), { currencyID: currency });
        w.leaf("cbc:TaxAmount", num(e.taxAmount), { currencyID: currency });
        w.block("cac:TaxCategory", () => {
          w.leaf("cbc:ID", e.category);
          if (e.category !== "O") w.leaf("cbc:Percent", num(e.rate));
          w.leaf("cbc:TaxExemptionReasonCode", e.exemptionReasonCode);
          w.leaf("cbc:TaxExemptionReason", e.exemptionReason);
          w.block("cac:TaxScheme", () => w.leaf("cbc:ID", "VAT"));
        });
      });
    }
  });
}

function writeLine(
  w: XmlWriter,
  line: InvoiceLine,
  index: number,
  currency: string,
  isCreditNote: boolean,
): void {
  w.block(isCreditNote ? "cac:CreditNoteLine" : "cac:InvoiceLine", () => {
    w.leaf("cbc:ID", line.id ?? String(index + 1));
    w.leaf(isCreditNote ? "cbc:CreditedQuantity" : "cbc:InvoicedQuantity", num(line.quantity), {
      unitCode: line.unitCode ?? "H87",
    });
    w.leaf("cbc:LineExtensionAmount", formatAmount(lineNetAmount(line)), {
      currencyID: currency,
    });
    for (const a of line.allowances ?? []) {
      w.block("cac:AllowanceCharge", () => {
        w.leaf("cbc:ChargeIndicator", "false");
        w.leaf("cbc:AllowanceChargeReasonCode", a.reasonCode);
        w.leaf("cbc:AllowanceChargeReason", a.reason);
        w.leaf("cbc:Amount", num(a.amount), { currencyID: currency });
      });
    }
    for (const c of line.charges ?? []) {
      w.block("cac:AllowanceCharge", () => {
        w.leaf("cbc:ChargeIndicator", "true");
        w.leaf("cbc:AllowanceChargeReasonCode", c.reasonCode);
        w.leaf("cbc:AllowanceChargeReason", c.reason);
        w.leaf("cbc:Amount", num(c.amount), { currencyID: currency });
      });
    }
    w.block("cac:Item", () => {
      w.leaf("cbc:Description", line.description);
      w.leaf("cbc:Name", line.name);
      if (line.classification) {
        w.block("cac:CommodityClassification", () =>
          w.leaf("cbc:ItemClassificationCode", line.classification!.value, {
            listID: line.classification!.scheme,
          }),
        );
      }
      w.block("cac:ClassifiedTaxCategory", () => {
        w.leaf("cbc:ID", line.vatCategory);
        if (line.vatCategory !== "O") w.leaf("cbc:Percent", num(line.vatRate));
        w.block("cac:TaxScheme", () => w.leaf("cbc:ID", "VAT"));
      });
    });
    w.block("cac:Price", () =>
      w.leaf("cbc:PriceAmount", num(line.unitPrice), { currencyID: currency }),
    );
  });
}

/**
 * Serijalizuje model u UBL 2.1 Invoice (ili CreditNote za typeCode 381).
 *
 * Rekapitulacija PDV-a i ukupni iznosi se računaju automatski ako nisu
 * eksplicitno navedeni - to je razlika između "gradi XML" i "gradi XML koji
 * prolazi validaciju".
 */
export function buildUbl(invoice: Invoice): string {
  const isCreditNote = invoice.typeCode === "381";
  const root = isCreditNote ? "CreditNote" : "Invoice";
  const currency = invoice.currency;

  const breakdown = invoice.vatBreakdown ?? computeVatBreakdown(invoice);
  const totals = invoice.totals ?? computeTotals(invoice, breakdown);

  const w = new XmlWriter();
  w.open(root, {
    xmlns: isCreditNote ? NS.cn : NS.inv,
    "xmlns:cac": NS.cac,
    "xmlns:cbc": NS.cbc,
  });

  w.leaf("cbc:CustomizationID", invoice.customizationId ?? DEFAULT_CUSTOMIZATION);
  w.leaf("cbc:ProfileID", invoice.profileId ?? DEFAULT_PROFILE);
  w.leaf("cbc:ID", invoice.id);
  w.leaf("cbc:IssueDate", invoice.issueDate);
  // HR-BT-2: hrvatski eRačun traži vrijeme izdavanja (HR-BR-2)
  w.leaf("cbc:IssueTime", invoice.issueTime);
  // UBL 2.1 CreditNote nema cbc:DueDate - tamo BT-9 ide kao
  // cac:PaymentMeans/cbc:PaymentDueDate, inače je izlaz XSD-nevalidan.
  if (!isCreditNote) w.leaf("cbc:DueDate", invoice.dueDate);
  w.leaf(isCreditNote ? "cbc:CreditNoteTypeCode" : "cbc:InvoiceTypeCode", invoice.typeCode ?? "380");
  for (const note of invoice.notes ?? []) w.leaf("cbc:Note", note);
  w.leaf("cbc:DocumentCurrencyCode", currency);
  w.leaf("cbc:BuyerReference", invoice.buyerReference);

  if (invoice.orderReference) {
    w.block("cac:OrderReference", () => w.leaf("cbc:ID", invoice.orderReference));
  }

  // Hrvatski CIUS mijenja mjesto kontakta prodavatelja
  const isHrProfile = (invoice.customizationId ?? "").includes("mfin.gov.hr");
  writeParty(w, "cac:AccountingSupplierParty", invoice.seller, isHrProfile);
  writeParty(w, "cac:AccountingCustomerParty", invoice.buyer);

  if (invoice.deliveryDate) {
    w.block("cac:Delivery", () => w.leaf("cbc:ActualDeliveryDate", invoice.deliveryDate));
  }

  if (invoice.paymentMeans) {
    const pm = invoice.paymentMeans;
    w.block("cac:PaymentMeans", () => {
      w.leaf("cbc:PaymentMeansCode", pm.code, { name: pm.description });
      if (isCreditNote) w.leaf("cbc:PaymentDueDate", invoice.dueDate);
      w.leaf("cbc:PaymentID", invoice.paymentReference);
      if (pm.accountId) {
        w.block("cac:PayeeFinancialAccount", () => {
          w.leaf("cbc:ID", pm.accountId);
          w.leaf("cbc:Name", pm.accountName);
          if (pm.bic) {
            w.block("cac:FinancialInstitutionBranch", () => w.leaf("cbc:ID", pm.bic));
          }
        });
      }
    });
  }

  for (const a of invoice.allowances ?? []) writeDocumentCharge(w, a, false, currency);
  for (const c of invoice.charges ?? []) writeDocumentCharge(w, c, true, currency);

  writeVatBreakdown(w, breakdown, currency);

  w.block("cac:LegalMonetaryTotal", () => {
    w.leaf("cbc:LineExtensionAmount", num(totals.lineNetTotal), { currencyID: currency });
    w.leaf("cbc:TaxExclusiveAmount", num(totals.netTotal), { currencyID: currency });
    w.leaf("cbc:TaxInclusiveAmount", num(totals.grossTotal), { currencyID: currency });
    w.leaf("cbc:AllowanceTotalAmount", num(totals.allowanceTotal), { currencyID: currency });
    w.leaf("cbc:ChargeTotalAmount", num(totals.chargeTotal), { currencyID: currency });
    w.leaf("cbc:PrepaidAmount", num(totals.paidAmount), { currencyID: currency });
    w.leaf("cbc:PayableRoundingAmount", num(totals.roundingAmount), { currencyID: currency });
    w.leaf("cbc:PayableAmount", num(totals.payableAmount), { currencyID: currency });
  });

  invoice.lines.forEach((line, i) => writeLine(w, line, i, currency, isCreditNote));

  w.close(root);
  return w.toString();
}
