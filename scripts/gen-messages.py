#!/usr/bin/env python3
"""
Generiše lokalizovane poruke pravila iz CEN artefakata.

Ulaz : vendor/cen/{ubl,cii}/schematron/preprocessed/*.sch  (nakon `npm run prepare:sef`)
Izlaz: packages/core/src/catalog/rules.json  (ruleId -> {en,hr,bs,sr,flag})

Strategija:
  - jezgro (BR-01..BR-65, BR-CO-*, BR-CL-*) : ručni prijevodi (RUCNO)
  - BR-DEC-*                                : šablon (broj decimala)
  - PDV kategorije (BR-S/Z/E/AE/AF/AG/G/O/IC/B/L/M-NN) : šablon po sufiksu × naziv kategorije
  - sve ostalo (UBL-CR, CII-SR, ...)        : ostaje engleski original

Pokretanje: python3 scripts/gen-messages.py
"""
import json, re, sys
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SCH_NS = "http://purl.oclc.org/dsdl/schematron"
SOURCES = [
    "vendor/cen/ubl/schematron/preprocessed/EN16931-UBL-validation-preprocessed.sch",
    "vendor/cen/cii/schematron/preprocessed/EN16931-CII-validation-preprocessed.sch",
]

# --- PDV kategorije: kod -> naziv po jeziku -------------------------------
CATEGORIES = {
    "S":  {"en": "Standard rated",        "hr": "standardna stopa",              "bs": "standardna stopa",              "sr": "standardna stopa"},
    "Z":  {"en": "Zero rated",            "hr": "nulta stopa",                   "bs": "nulta stopa",                   "sr": "nulta stopa"},
    "E":  {"en": "Exempt from VAT",       "hr": "oslobođeno PDV-a",              "bs": "oslobođeno PDV-a",              "sr": "oslobođeno PDV-a"},
    "AE": {"en": "VAT Reverse Charge",    "hr": "prijenos porezne obveze",       "bs": "prijenos porezne obaveze",      "sr": "prenos poreske obaveze"},
    "IC": {"en": "Intra-community supply","hr": "isporuka unutar EU",            "bs": "isporuka unutar EU",            "sr": "isporuka unutar EU"},
    "G":  {"en": "Export outside the EU", "hr": "izvoz izvan EU",                "bs": "izvoz izvan EU",                "sr": "izvoz izvan EU"},
    "O":  {"en": "Not subject to VAT",    "hr": "nije predmet oporezivanja PDV-om", "bs": "nije predmet oporezivanja PDV-om", "sr": "nije predmet oporezivanja PDV-om"},
    "AF": {"en": "IGIC",                  "hr": "IGIC (Kanarski otoci)",         "bs": "IGIC (Kanarska ostrva)",        "sr": "IGIC (Kanarska ostrva)"},
    "AG": {"en": "IPSI",                  "hr": "IPSI (Ceuta i Melilla)",        "bs": "IPSI (Ceuta i Melilla)",        "sr": "IPSI (Seuta i Melilja)"},
    "B":  {"en": "Split payment",         "hr": "podijeljeno plaćanje",          "bs": "podijeljeno plaćanje",          "sr": "podeljeno plaćanje"},
}

# --- šabloni za PDV porodice, po sufiksu pravila --------------------------
# {c} = naziv kategorije na ciljnom jeziku
VAT_TPL = {
    "hr": {
        "01": 'Račun koji sadrži stavku (BG-25), popust (BG-20) ili trošak (BG-21) s PDV kategorijom "{c}" mora u rekapitulaciji PDV-a (BG-23) imati barem jednu kategoriju (BT-118) "{c}".',
        "02": 'Račun sa stavkom (BG-25) u PDV kategoriji "{c}" mora sadržavati PDV ID prodavatelja (BT-31), porezni broj (BT-32) i/ili PDV ID poreznog zastupnika (BT-63).',
        "03": 'Račun s popustom (BG-20) u PDV kategoriji "{c}" mora sadržavati PDV ID prodavatelja (BT-31), porezni broj (BT-32) i/ili PDV ID poreznog zastupnika (BT-63).',
        "04": 'Račun s troškom (BG-21) u PDV kategoriji "{c}" mora sadržavati PDV ID prodavatelja (BT-31), porezni broj (BT-32) i/ili PDV ID poreznog zastupnika (BT-63).',
        "02-NE": 'Račun sa stavkom (BG-25) u PDV kategoriji "{c}" NE SMIJE sadržavati PDV ID prodavatelja (BT-31), porezni broj (BT-32) ni PDV ID poreznog zastupnika (BT-63).',
        "03-NE": 'Račun s popustom (BG-20) u PDV kategoriji "{c}" NE SMIJE sadržavati PDV ID prodavatelja (BT-31), porezni broj (BT-32) ni PDV ID poreznog zastupnika (BT-63).',
        "04-NE": 'Račun s troškom (BG-21) u PDV kategoriji "{c}" NE SMIJE sadržavati PDV ID prodavatelja (BT-31), porezni broj (BT-32) ni PDV ID poreznog zastupnika (BT-63).',
        "05": 'U stavci (BG-25) s PDV kategorijom "{c}" stopa PDV-a (BT-152) mora biti veća od nule.',
        "06": 'U popustu (BG-20) s PDV kategorijom "{c}" stopa PDV-a (BT-96) mora biti veća od nule.',
        "07": 'U trošku (BG-21) s PDV kategorijom "{c}" stopa PDV-a (BT-103) mora biti veća od nule.',
        "08": 'Za kategoriju "{c}" osnovica (BT-116) mora biti jednaka zbroju neto iznosa stavki (BT-131) uvećanom za troškove (BT-99) i umanjenom za popuste (BT-92) iste kategorije.',
        "09-CALC": 'Iznos PDV-a (BT-117) u rekapitulaciji (BG-23) za kategoriju "{c}" mora biti jednak osnovici (BT-116) pomnoženoj sa stopom (BT-119).',
        "09-ZERO": 'Iznos PDV-a (BT-117) u rekapitulaciji (BG-23) za kategoriju "{c}" mora biti 0.',
        "09-SUM":  'Iznos PDV-a (BT-117) u rekapitulaciji (BG-23) za kategoriju "{c}" mora odgovarati osnovici (BT-116) te kategorije.',
        "10-NO":   'Rekapitulacija PDV-a (BG-23) s kategorijom "{c}" ne smije imati razlog oslobođenja (ni BT-120 ni BT-121).',
        "10-HAS":  'Rekapitulacija PDV-a (BG-23) s kategorijom "{c}" mora imati šifru razloga oslobođenja (BT-121) ili tekst razloga (BT-120).',
    },
    "bs": {
        "01": 'Faktura koja sadrži stavku (BG-25), popust (BG-20) ili trošak (BG-21) s PDV kategorijom "{c}" mora u rekapitulaciji PDV-a (BG-23) imati najmanje jednu kategoriju (BT-118) "{c}".',
        "02": 'Faktura sa stavkom (BG-25) u PDV kategoriji "{c}" mora sadržavati PDV broj prodavca (BT-31), poreski broj (BT-32) i/ili PDV broj poreskog zastupnika (BT-63).',
        "03": 'Faktura s popustom (BG-20) u PDV kategoriji "{c}" mora sadržavati PDV broj prodavca (BT-31), poreski broj (BT-32) i/ili PDV broj poreskog zastupnika (BT-63).',
        "04": 'Faktura s troškom (BG-21) u PDV kategoriji "{c}" mora sadržavati PDV broj prodavca (BT-31), poreski broj (BT-32) i/ili PDV broj poreskog zastupnika (BT-63).',
        "02-NE": 'Faktura sa stavkom (BG-25) u PDV kategoriji "{c}" NE SMIJE sadržavati PDV broj prodavca (BT-31), poreski broj (BT-32) ni PDV broj poreskog zastupnika (BT-63).',
        "03-NE": 'Faktura s popustom (BG-20) u PDV kategoriji "{c}" NE SMIJE sadržavati PDV broj prodavca (BT-31), poreski broj (BT-32) ni PDV broj poreskog zastupnika (BT-63).',
        "04-NE": 'Faktura s troškom (BG-21) u PDV kategoriji "{c}" NE SMIJE sadržavati PDV broj prodavca (BT-31), poreski broj (BT-32) ni PDV broj poreskog zastupnika (BT-63).',
        "05": 'U stavci (BG-25) s PDV kategorijom "{c}" stopa PDV-a (BT-152) mora biti veća od nule.',
        "06": 'U popustu (BG-20) s PDV kategorijom "{c}" stopa PDV-a (BT-96) mora biti veća od nule.',
        "07": 'U trošku (BG-21) s PDV kategorijom "{c}" stopa PDV-a (BT-103) mora biti veća od nule.',
        "08": 'Za kategoriju "{c}" osnovica (BT-116) mora biti jednaka zbiru neto iznosa stavki (BT-131) uvećanom za troškove (BT-99) i umanjenom za popuste (BT-92) iste kategorije.',
        "09-CALC": 'Iznos PDV-a (BT-117) u rekapitulaciji (BG-23) za kategoriju "{c}" mora biti jednak osnovici (BT-116) pomnoženoj sa stopom (BT-119).',
        "09-ZERO": 'Iznos PDV-a (BT-117) u rekapitulaciji (BG-23) za kategoriju "{c}" mora biti 0.',
        "09-SUM":  'Iznos PDV-a (BT-117) u rekapitulaciji (BG-23) za kategoriju "{c}" mora odgovarati osnovici (BT-116) te kategorije.',
        "10-NO":   'Rekapitulacija PDV-a (BG-23) s kategorijom "{c}" ne smije imati razlog oslobođenja (ni BT-120 ni BT-121).',
        "10-HAS":  'Rekapitulacija PDV-a (BG-23) s kategorijom "{c}" mora imati šifru razloga oslobođenja (BT-121) ili tekst razloga (BT-120).',
    },
}
VAT_TPL["sr"] = {k: v.replace("mora biti", "mora da bude").replace("mora sadržavati", "mora da sadrži")
                 for k, v in VAT_TPL["bs"].items()}

# Sufiksi 09 i 10 NEMAJU isto značenje za sve kategorije: kod oporezivih (S, Z, AF, AG)
# PDV se računa i razlog oslobođenja je zabranjen; kod oslobođenih (E, AE, G, IC, O)
# iznos PDV-a je nula, a razlog oslobođenja je OBAVEZAN. Zato se varijanta bira po kategoriji.
VAT_VARIANT = {
    "S":  {"09": "09-CALC", "10": "10-NO"},
    "AF": {"09": "09-CALC", "10": "10-NO"},
    "AG": {"09": "09-CALC", "10": "10-NO"},
    "Z":  {"09": "09-SUM",  "10": "10-NO"},
    "E":  {"09": "09-SUM",  "10": "10-HAS"},
    "AE": {"09": "09-ZERO", "10": "10-HAS"},
    "G":  {"09": "09-ZERO", "10": "10-HAS"},
    "IC": {"09": "09-ZERO", "10": "10-HAS"},
    # Kategorija "O" invertira i 02/03/04: kod ostalih je porezni identifikator
    # OBAVEZAN, kod nje je ZABRANJEN. Isti obrazac kao kod 09 i 10.
    "O":  {"02": "02-NE", "03": "03-NE", "04": "04-NE", "09": "09-ZERO", "10": "10-HAS"},
    "B":  {"09": "09-CALC", "10": "10-NO"},
}

DEC_TPL = {
    "hr": "Najveći dopušteni broj decimala za {t} je {n}.",
    "bs": "Najveći dozvoljeni broj decimala za {t} je {n}.",
    "sr": "Najveći dozvoljeni broj decimala za {t} je {n}.",
}

# --- ručni prijevodi jezgra ------------------------------------------------
MANUAL = json.loads((ROOT / "scripts" / "messages.manual.json").read_text(encoding="utf-8"))


def load_rules() -> dict:
    rules = {}
    for rel in SOURCES:
        p = ROOT / rel
        if not p.exists():
            sys.exit(f"Nedostaje {rel}. Pokreni prvo `npm run prepare:sef`.")
        tree = ET.parse(p)
        for tag in ("assert", "report"):
            for el in tree.iter(f"{{{SCH_NS}}}{tag}"):
                rid = el.get("id")
                if not rid:
                    continue
                txt = re.sub(r"\s+", " ", "".join(el.itertext())).strip()
                txt = re.sub(r"^\[[^\]]+\]\s*-\s*", "", txt)
                if rid not in rules or len(txt) > len(rules[rid]["en"]):
                    rules[rid] = {"en": txt, "flag": el.get("flag") or "fatal"}
    return rules


def localize(rid: str, en: str) -> dict:
    if rid in MANUAL:
        return MANUAL[rid]

    m = re.match(r"^BR-([A-Z]{1,2})-(\d{2})$", rid)
    if m and m.group(1) in CATEGORIES:
        cat, suffix = m.group(1), m.group(2)
        key = VAT_VARIANT.get(cat, {}).get(suffix, suffix)
        if key in VAT_TPL["hr"]:
            return {lang: VAT_TPL[lang][key].format(c=CATEGORIES[cat][lang])
                    for lang in ("hr", "bs", "sr")}

    if rid.startswith("BR-DEC-"):
        term = re.search(r"for the (.+?) \((BT-\d+)\) is (\d+)", en)
        if term:
            label, bt, n = term.group(1), term.group(2), term.group(3)
            tr = MANUAL.get("_terms", {}).get(bt)
            for lang in ("hr", "bs", "sr"):
                pass
            return {lang: DEC_TPL[lang].format(t=(tr[lang] if tr else label) + f" ({bt})", n=n)
                    for lang in ("hr", "bs", "sr")}
    return {}


def main() -> None:
    rules = load_rules()
    out, localized = {}, 0
    for rid, data in sorted(rules.items()):
        # `flag` se ne zapisuje: ozbiljnost dolazi iz SVRL izlaza pri validaciji,
        # a duplikat u katalogu niko nije čitao (1562 mrtva unosa).
        entry = {"en": data["en"]}
        loc = localize(rid, data["en"])
        if loc:
            entry.update({k: v for k, v in loc.items() if k in ("hr", "bs", "sr")})
            localized += 1
        out[rid] = entry

    dest = ROOT / "packages" / "core" / "src" / "catalog" / "rules.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    br = [r for r in out if r.startswith("BR")]
    br_loc = [r for r in br if "bs" in out[r]]
    print(f"Ukupno pravila : {len(out)}")
    print(f"Lokalizovano   : {localized}")
    print(f"BR-* pokrivenost: {len(br_loc)}/{len(br)} ({100*len(br_loc)//len(br)}%)")
    print(f"Zapisano u {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
