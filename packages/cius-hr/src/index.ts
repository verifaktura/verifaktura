import { fileURLToPath } from "node:url";
import { registerProfile, type ProfileDefinition } from "verifaktura";

/**
 * Oznaka specifikacije (cbc:CustomizationID) koju propisuje Porezna uprava RH.
 * Hrvatski schematron se primjenjuje ISKLJUČIVO na UBL dokumente s ovom oznakom.
 *
 * Vrijednost je preuzeta iz samog schematrona (pravilo HR-BR-5), ne iz opisa na
 * web stranici - tamo se u string uvukla fusnota pa je ispadalo "ext[1]2025".
 *
 * Izvor: HR-CIUS-EXT-EN16931-UBL.sch, Porezna uprava RH
 */
export const HR_CUSTOMIZATION_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.hr:cius-2025:1.0" +
  "#conformant#urn:mfin.gov.hr:ext-2025:1.0";

/**
 * Hrvatski CIUS profil.
 *
 * Artefakti se ne distribuiraju s paketom nego se preuzimaju skriptom
 * `npm run prepare:sef` s porezna.gov.hr (dokument 197, "Validator - dorađena
 * verzija - u primjeni od 15.3.2026."). Sadržaj se smije prenositi uz navođenje
 * izvora, ali verziju kontrolira Porezna uprava - preuzimanje pri buildu
 * osigurava da nikad ne validiramo po zastarjelim pravilima.
 */
export const hrProfile: ProfileDefinition = {
  id: "hr",
  label: "Hrvatska - Fiskalizacija 2.0 (CIUS + proširenja)",
  version: "2026-03-15",
  source: "Ministarstvo financija - Porezna uprava RH",
  syntax: ["ubl"],
  matches: (customizationId) => customizationId === HR_CUSTOMIZATION_ID,
  sefPath: fileURLToPath(new URL("../sef/hr-cius-ext-ubl.sef.json", import.meta.url)),
  /**
   * CEN-ova sintaksna pravila koja hrvatski CIUS namjerno krši.
   *
   * Popis je izveden iz službenih primjera eRačuna Porezne uprave: svih 20
   * primjera koristi elemente koje CEN označava s "should not include", a
   * hrvatski schematron ih zahtijeva ili validira.
   *
   *  - UBL-CR-006: cbc:IssueTime                       -> HR-BR-2
   *  - UBL-CR-200: cac:SellerContact                   -> HR-BR-37, HR-BR-9
   *  - UBL-CR-001: ext:UBLExtensions                   -> nosač HR proširenja
   *  - UBL-CR-504: TaxSubtotal TaxCategory/cbc:Name    -> HR šifre u rekapitulaciji
   *  - UBL-CR-597: ClassifiedTaxCategory/cbc:Name      -> HR šifre (npr. "HR:PDV25")
   *  - UBL-CR-600: ClassifiedTaxCategory TaxExemptionReasonCode -> HR-BR-36
   *  - UBL-CR-477: AllowanceCharge TaxCategory/cbc:Name -> isto, na popustima
   *  - UBL-CR-601: ClassifiedTaxCategory TaxExemptionReason -> HR razlozi oslobođenja
   *  - UBL-CR-481: AllowanceCharge TaxCategory TaxExemptionReason -> isto
   */
  overrides: [
    "UBL-CR-006",
    "UBL-CR-200",
    "UBL-CR-001",
    "UBL-CR-504",
    "UBL-CR-597",
    "UBL-CR-600",
    "UBL-CR-477",
    "UBL-CR-601",
    "UBL-CR-481",
  ],
};

registerProfile(hrProfile);

export default hrProfile;
