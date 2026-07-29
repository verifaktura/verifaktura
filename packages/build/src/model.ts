/**
 * Tipizirani EN 16931 model fakture.
 *
 * Imena polja prate poslovne termine standarda (BT/BG) da bi mapiranje na
 * validacione greške bilo direktno: kad validator prijavi BT-31, korisnik zna
 * koje polje modela treba popraviti. Zato je svako polje označeno svojim BT-om.
 */

/** Novčani iznos kao string da se izbjegne float aritmetika. Npr. "1234.56". */
export type Amount = string;

/** Datum u ISO formatu (YYYY-MM-DD). */
export type IsoDate = string;

/** PDV kategorija po UNCL 5305. */
export type VatCategory =
  | "S"  // standardna stopa
  | "Z"  // nulta stopa
  | "E"  // oslobođeno PDV-a
  | "AE" // prijenos porezne obaveze
  | "K"  // isporuka unutar EU
  | "G"  // izvoz izvan EU
  | "O"  // nije predmet oporezivanja
  | "L"  // IGIC
  | "M"; // IPSI

export interface Address {
  /** BT-35 / BT-50 */ street?: string;
  /** BT-36 / BT-51 */ additionalStreet?: string;
  /** BT-37 / BT-52 */ city?: string;
  /** BT-38 / BT-53 */ postalCode?: string;
  /** BT-39 / BT-54 */ subdivision?: string;
  /** BT-40 / BT-55 - ISO 3166-1 alpha-2, obavezno */ country: string;
}

/** Kontakt osoba/operater. Hrvatski CIUS ga traži na prodavcu (HR-BT-4, HR-BT-5). */
export interface Contact {
  /** HR-BT-4 - oznaka/ime operatera koji je izdao račun */
  name?: string;
  /** HR-BT-5 - identifikator operatera; u HR mora biti ispravan OIB */
  id?: string;
  phone?: string;
  email?: string;
}

export interface Party {
  /** BT-27 / BT-44 - naziv, obavezno */
  name: string;
  /** BT-28 / BT-45 - trgovački naziv ako se razlikuje */
  tradingName?: string;
  /**
   * BT-31 / BT-48 - PDV identifikator.
   * MORA imati prefiks države po ISO 3166-1 alpha-2 (BR-CO-09).
   * Za BiH: PDV broj 210300400000 se piše kao "BA210300400000".
   */
  vatId?: string;
  /** BT-30 / BT-47 - matični/registracijski broj (JIB, OIB, MB) */
  legalId?: string;
  /** Shema registracijskog broja po ISO 6523 ICD, npr. "9934" za HR OIB */
  legalIdScheme?: string;
  /** BT-32 - poreski broj prodavca (kad nema PDV ID) */
  taxRegistrationId?: string;
  /** BT-34 / BT-49 - elektronska adresa; shema je obavezna (BR-62/BR-63) */
  electronicAddress?: { value: string; scheme: string };
  address: Address;
  /**
   * cac:SellerContact / cac:Contact - podaci o operateru.
   * Obavezno za hrvatski eRačun: HR-BR-37 (naziv) i HR-BR-9 (ispravan OIB).
   */
  contact?: Contact;
}

export interface InvoiceLine {
  /** BT-126 - redni broj; ako se izostavi, dodjeljuje se automatski */
  id?: string;
  /** BT-153 - naziv artikla, obavezno */
  name: string;
  /** BT-154 - opis */
  description?: string;
  /** BT-129 - količina, obavezno */
  quantity: string;
  /** BT-130 - jedinica mjere po UN/ECE Rec 20; default "H87" (komad) */
  unitCode?: string;
  /** BT-146 - neto cijena po jedinici, obavezno */
  unitPrice: Amount;
  /**
   * BT-131 - neto iznos stavke.
   * Ako se izostavi, računa se kao quantity × unitPrice − popusti + troškovi.
   */
  netAmount?: Amount;
  /** BT-151 - PDV kategorija stavke, obavezno */
  vatCategory: VatCategory;
  /**
   * BT-152 - PDV stopa u procentima, npr. "17".
   * Za kategoriju "O" (nije predmet oporezivanja) stopa se NE navodi (BR-O-05).
   */
  vatRate?: string;
  /**
   * BT-120 - razlog oslobođenja od PDV-a.
   * Obavezan za kategorije E, AE, K, G i O (BR-E-10, BR-AE-10, ...). Prenosi se
   * u rekapitulaciju PDV-a kad se ona računa automatski.
   */
  vatExemptionReason?: string;
  /** BT-121 - šifra razloga oslobođenja (CEF VATEX). */
  vatExemptionReasonCode?: string;
  /**
   * HR-BT-12 - hrvatska oznaka PDV kategorije, npr. "HR:PDV25", "HR:E", "HR:O".
   *
   * Nacionalno proširenje: HR-BR-16 traži je za stavke u kategoriji E ili O,
   * pa bez nje hrvatski eRačun s oslobođenom isporukom nije moguće sastaviti.
   * Za ostale profile se izostavlja.
   */
  vatCategoryName?: string;
  /** BG-27 - popusti na stavci */
  allowances?: LineCharge[];
  /** BG-28 - troškovi na stavci */
  charges?: LineCharge[];
  /**
   * BT-158 - klasifikacijska oznaka artikla.
   * Za hrvatski eRačun: KPD 2025, šesteroznamenkasta, sa `scheme: "CG"` (HR-BR-25).
   */
  classification?: { value: string; scheme: string };
}

export interface LineCharge {
  /** BT-136 / BT-141 - iznos */
  amount: Amount;
  /** BT-139 / BT-144 - razlog; obavezan uz šifru ili umjesto nje */
  reason?: string;
  /** BT-140 / BT-145 - šifra razloga (UNCL 5189 / 7161) */
  reasonCode?: string;
}

export interface DocumentCharge extends LineCharge {
  /** BT-95 / BT-102 - PDV kategorija, obavezna na razini dokumenta */
  vatCategory: VatCategory;
  /** BT-96 / BT-103 - PDV stopa; izostavlja se za kategoriju "O" */
  vatRate?: string;
  /** BT-120 - razlog oslobođenja, kao na stavci */
  vatExemptionReason?: string;
  /** BT-121 - šifra razloga oslobođenja */
  vatExemptionReasonCode?: string;
  /** HR-BT-12 - hrvatska oznaka PDV kategorije, kao na stavci */
  vatCategoryName?: string;
  /** BT-93 / BT-100 - osnovica za procentualni popust/trošak */
  baseAmount?: Amount;
}

export interface PaymentMeans {
  /** BT-81 - šifra načina plaćanja po UNTDID 4461; 30 = virman */
  code: string;
  /** BT-82 - opis načina plaćanja */
  description?: string;
  /** BT-84 - IBAN ili broj računa; obavezan za transfer (BR-50, BR-61) */
  accountId?: string;
  /** BT-85 - naziv vlasnika računa */
  accountName?: string;
  /** BT-86 - BIC */
  bic?: string;
}

export interface VatBreakdownEntry {
  /** BT-118 */ category: VatCategory;
  /** BT-119 - izostavlja se za kategoriju "O" (BR-48 dopušta izuzetak) */
  rate?: string;
  /** BT-116 */ taxableAmount: Amount;
  /** BT-117 */ taxAmount: Amount;
  /** BT-120 - obavezan za oslobođene kategorije (BR-E-10, BR-AE-10, ...) */
  exemptionReason?: string;
  /** BT-121 - šifra razloga po CEF VATEX */
  exemptionReasonCode?: string;
  /** HR-BT-12 - hrvatska oznaka PDV kategorije u rekapitulaciji */
  categoryName?: string;
}

export interface Totals {
  /** BT-106 */ lineNetTotal: Amount;
  /** BT-107 */ allowanceTotal?: Amount;
  /** BT-108 */ chargeTotal?: Amount;
  /** BT-109 */ netTotal: Amount;
  /** BT-110 */ vatTotal: Amount;
  /** BT-112 */ grossTotal: Amount;
  /** BT-113 */ paidAmount?: Amount;
  /** BT-114 */ roundingAmount?: Amount;
  /** BT-115 */ payableAmount: Amount;
}

export interface Invoice {
  /**
   * BT-24 - oznaka specifikacije.
   * Default je čisti EN 16931; za hrvatski eRačun koristi HR_CUSTOMIZATION_ID.
   */
  customizationId?: string;
  /**
   * BT-23 - identifikator poslovnog procesa.
   * Za hrvatski eRačun mora biti P1-P12 ili P99:<oznaka kupca> (HR-BR-34).
   */
  profileId?: string;
  /** BT-1 - broj fakture, obavezno */
  id: string;
  /** BT-2 - datum izdavanja, obavezno */
  issueDate: IsoDate;
  /**
   * HR-BT-2 - vrijeme izdavanja u formatu hh:mm:ss.
   * Nije dio EN 16931, ali je obavezno za hrvatski eRačun (HR-BR-2).
   */
  issueTime?: string;
  /** BT-9 - datum dospijeća */
  dueDate?: IsoDate;
  /** BT-3 - šifra vrste dokumenta; 380 = faktura, 381 = odobrenje */
  typeCode?: string;
  /** BT-5 - valuta po ISO 4217, obavezno (npr. "BAM", "EUR") */
  currency: string;
  /** BT-22 - napomene */
  notes?: string[];
  /** BT-72 - stvarni datum isporuke */
  deliveryDate?: IsoDate;
  /** BT-13 - broj narudžbenice kupca */
  buyerReference?: string;
  /** BT-10 - referenca kupca (obavezna kod nekih CIUS profila) */
  orderReference?: string;

  /** BG-4 */ seller: Party;
  /** BG-7 */ buyer: Party;
  /** BG-25 - najmanje jedna stavka (BR-16) */ lines: InvoiceLine[];
  /** BG-20 - popusti na razini dokumenta */ allowances?: DocumentCharge[];
  /** BG-21 - troškovi na razini dokumenta */ charges?: DocumentCharge[];
  /** BG-16 */ paymentMeans?: PaymentMeans;
  /** BT-83 - poziv na broj */ paymentReference?: string;

  /**
   * BG-23 - rekapitulacija PDV-a.
   * Ako se izostavi, računa se automatski iz stavki i popusta/troškova.
   */
  vatBreakdown?: VatBreakdownEntry[];
  /**
   * Ukupni iznosi. Ako se izostave, računaju se automatski.
   * Eksplicitno navođenje je korisno kad se preslikava postojeći dokument
   * i želi se zadržati original čak i ako se ne slaže s izračunom.
   */
  totals?: Totals;
}
