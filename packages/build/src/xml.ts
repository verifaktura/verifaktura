/** Minimalni XML writer - bez zavisnosti, s ispravnim escapeom i uvlačenjem. */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type Attrs = Record<string, string | undefined>;

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

  /** Element s tekstom. Preskače se ako je vrijednost undefined ili prazna. */
  leaf(name: string, value: string | undefined, attrs?: Attrs): this {
    if (value === undefined || value === "") return this;
    this.parts.push(
      `${this.indent()}<${name}${this.attrs(attrs)}>${escapeXml(value)}</${name}>`,
    );
    return this;
  }

  /** Otvara element, izvršava blok, zatvara. Preskače se ako je `when` false. */
  block(name: string, fn: () => void, attrs?: Attrs, when = true): this {
    if (!when) return this;
    this.open(name, attrs);
    fn();
    this.close(name);
    return this;
  }

  toString(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${this.parts.join("\n")}\n`;
  }
}
