/** Minimalni XML writer - bez zavisnosti, s ispravnim escapeom i uvlačenjem. */

/**
 * C0 kontrolni znakovi zabranjeni u XML 1.0 (dozvoljeni su samo tab, LF i CR).
 * Escapeanje ne pomaže - `&#x1;` je jednako nedozvoljen kao i sirovi znak.
 */
const ILLEGAL_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

/**
 * Uklanja znakove koje XML 1.0 ne dopušta ni u escapeanom obliku.
 *
 * Bez ovoga izlaz može biti "well-formed-invalid": xmldom i Saxon su tolerantni
 * pa ga round-trip propusti, a stroži primatelj ga odbije. Podaci s kontrolnim
 * znakovima stižu iz ERP izvoza i copy-paste unosa češće nego što se očekuje.
 */
export function stripIllegalXmlChars(value: string): string {
  return value.replace(ILLEGAL_XML_CHARS, "");
}

export function escapeXml(value: string): string {
  return stripIllegalXmlChars(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type Attrs = Record<string, string | number | undefined>;

export class XmlWriter {
  private readonly parts: string[] = [];
  private depth = 0;

  private indent(): string {
    return "  ".repeat(this.depth);
  }

  private attrs(attrs?: Attrs): string {
    if (!attrs) return "";
    return Object.entries(attrs)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
      .join("");
  }

  open(name: string, attrs?: Attrs): this {
    this.parts.push(`${this.indent()}<${name}${this.attrs(attrs)}>`);
    this.depth++;
    return this;
  }

  close(name: string): this {
    this.depth--;
    this.parts.push(`${this.indent()}</${name}>`);
    return this;
  }

  /**
   * Element s tekstom. Preskače se ako je vrijednost undefined ili prazna.
   *
   * Vrijednost se koercira u string kao i kod atributa - JS pozivalac bez
   * tipova (npr. `quantity: 2`) je inače dobivao `value.replace is not a
   * function` iz utrobe writera, bez naznake kojeg polja.
   */
  leaf(name: string, value: string | number | undefined, attrs?: Attrs): this {
    if (value === undefined || value === "") return this;
    this.parts.push(
      `${this.indent()}<${name}${this.attrs(attrs)}>${escapeXml(String(value))}</${name}>`,
    );
    return this;
  }

  /** Otvara element, izvršava blok, zatvara. */
  block(name: string, fn: () => void): this {
    this.open(name);
    fn();
    this.close(name);
    return this;
  }

  toString(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${this.parts.join("\n")}\n`;
  }
}
