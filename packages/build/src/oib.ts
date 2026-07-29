/**
 * OIB — hrvatski osobni identifikacijski broj.
 *
 * 11 znamenki, zadnja je kontrolna po ISO 7064 MOD 11,10.
 * Hrvatski CIUS to provjerava (HR-BR-9, HR-BR-53), pa builder mora moći
 * potvrditi broj prije nego dokument ode na validaciju.
 */

/** Provjerava kontrolnu znamenku OIB-a po ISO 7064 MOD 11,10. */
export function isValidOib(oib: string): boolean {
  const digits = oib.trim();
  if (!/^\d{11}$/.test(digits)) return false;

  let remainder = 10;
  for (let i = 0; i < 10; i++) {
    remainder = (remainder + Number(digits[i])) % 10;
    if (remainder === 0) remainder = 10;
    remainder = (remainder * 2) % 11;
  }
  const check = (11 - remainder) % 10;
  return check === Number(digits[10]);
}

/**
 * Izvlači OIB iz PDV identifikatora ("HR12345678903" -> "12345678903").
 * Vraća undefined ako vrijednost nije hrvatski PDV ID.
 */
export function oibFromVatId(vatId: string | undefined): string | undefined {
  if (!vatId) return undefined;
  const m = /^HR(\d{11})$/.exec(vatId.trim().toUpperCase());
  return m ? m[1] : undefined;
}

/** Baca grešku s korisnom porukom ako OIB nije ispravan. */
export function assertValidOib(oib: string, field = "OIB"): void {
  if (!isValidOib(oib)) {
    throw new Error(
      `${field} "${oib}" nije ispravan: mora imati 11 znamenki i valjanu kontrolnu znamenku (ISO 7064 MOD 11,10).`,
    );
  }
}
