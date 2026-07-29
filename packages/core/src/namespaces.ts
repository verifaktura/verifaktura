/**
 * XML namespace URI-ji koji se koriste i pri čitanju i pri gradnji dokumenata.
 *
 * Bili su duplirani u `core/detect.ts` i `build/ubl.ts`; jedna tipfeler-greška
 * na jednom mjestu značila bi da validator i builder gledaju različite
 * dokumente, a to se ne bi vidjelo dok neka faktura tiho ne prođe pogrešno.
 */
export const NS = {
  /** UBL 2.1 Invoice */
  ublInvoice: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  /** UBL 2.1 CreditNote */
  ublCreditNote: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
  /** UBL Common Aggregate Components */
  cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  /** UBL Common Basic Components */
  cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  /** UBL Common Extension Components */
  ext: "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
  /** UN/CEFACT Cross Industry Invoice D16B */
  cii: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  /** CII Reusable Aggregate Business Information Entity */
  ram: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  /** Hrvatsko proširenje (Ministarstvo financija) */
  hrExt: "urn:mfin.gov.hr:schema:xsd:HRExtensionAggregateComponents-1",
} as const;

/** SVRL - izlaz Schematron validacije. */
export const SVRL_NS = "http://purl.oclc.org/dsdl/svrl";
