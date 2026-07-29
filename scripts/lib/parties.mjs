/**
 * Testne strane za e2e i round-trip.
 *
 * Bile su copy-paste u dva skripta i u build.test.ts, pa je promjena jednog
 * OIB-a značila tri mjesta - i tiho razilaženje kad se zaboravi jedno.
 * OIB-ovi prolaze ISO 7064 MOD 11,10 kontrolu.
 */

export const baSeller = {
  name: "Primjer Telekom d.o.o.",
  vatId: "BA210300400000",
  legalId: "4210300400000",
  electronicAddress: { value: "BA210300400000", scheme: "9930" },
  address: { street: "Primjerska bb", city: "Gracanica", postalCode: "75320", country: "BA" },
};

export const baBuyer = {
  name: "Primjer Obrt vl. Ime Prezime",
  legalId: "4329167750000",
  electronicAddress: { value: "4329167750000", scheme: "9930" },
  address: { street: "Primjerska 56", city: "Mostar", postalCode: "88000", country: "BA" },
};

export const hrSeller = {
  name: "Primjer d.o.o.",
  vatId: "HR12345678903",
  legalId: "12345678903",
  electronicAddress: { value: "12345678903", scheme: "9934" },
  address: { street: "Ilica 1", city: "Zagreb", postalCode: "10000", country: "HR" },
  contact: { name: "Operater 1", id: "12345678903" }, // HR-BT-4, HR-BT-5
};

export const hrBuyer = {
  name: "Kupac d.o.o.",
  vatId: "HR98765432106",
  legalId: "98765432106",
  electronicAddress: { value: "98765432106", scheme: "9934" },
  address: { street: "Riva 2", city: "Split", postalCode: "21000", country: "HR" },
};

export const HR_IBAN = "HR1210010051863000160";
export const BA_IBAN = "BA391941051193401279";
