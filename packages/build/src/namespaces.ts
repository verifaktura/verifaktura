/**
 * XML namespace URI-ji za gradnju dokumenata.
 *
 * Namjerno su kopija onih u `verifaktura` (jezgro), a ne import. Dijeljenje
 * kroz paket bi značilo da `@verifaktura/build` u runtimeu vuče cijeli
 * validator s 12 MB artefakata — samo zbog osam konstanti. Generator faktura
 * mora biti upotrebljiv i bez validatora.
 *
 * Da kopije ne mogu tiho razići se, `namespaces.test.ts` uspoređuje ova dva
 * popisa.
 */
export const NS = {
  ublInvoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  ublCreditNote: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  cii: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  ram: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  hrExt: "urn:mfin.gov.hr:schema:xsd:HRExtensionAggregateComponents-1",
} as const;
