import { describe, it, expect } from "vitest";
import { NS as BUILD_NS } from "../src/namespaces.js";
import { NS as CORE_NS } from "../../core/src/namespaces.js";

/**
 * Namespace popisi su namjerno duplicirani: dijeljenje kroz paket bi značilo da
 * generator faktura u runtimeu vuče cijeli validator s 12 MB artefakata.
 *
 * Cijena duplikata je rizik da se raziđu — a to se ne bi vidjelo dok neka
 * faktura tiho ne prođe pogrešno, jer bi validator i builder gledali različite
 * dokumente. Zato ih ovaj test drži identičnima.
 */
describe("namespace popisi", () => {
  it("builder i jezgro imaju iste vrijednosti", () => {
    expect(BUILD_NS).toEqual(CORE_NS);
  });

  it("pokrivaju sve što builder piše", () => {
    for (const key of ["ublInvoice", "ublCreditNote", "cac", "cbc", "ext", "hrExt"]) {
      expect(BUILD_NS).toHaveProperty(key);
    }
  });
});
