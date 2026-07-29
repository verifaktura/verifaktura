# Validation report format

Versioned through the `reportVersion` field. Currently **1.0**.

## Example

```json
{
  "reportVersion": "1.0",
  "engine": "verifaktura/0.1.5",
  "validatedAt": "2026-07-29T10:47:12.331Z",
  "valid": false,
  "document": {
    "syntax": "ubl",
    "type": "invoice",
    "customizationId": "urn:cen.eu:en16931:2017",
    "currency": "EUR",
    "supplier": { "name": "De Koksmaat", "vatId": "NL8200.98.395.B.01" },
    "customer": { "name": "ODIN 59" },
    "payableAmount": "250.33"
  },
  "profiles": [{ "id": "en16931", "version": "1.3.16", "source": "CEN/TC 434" }],
  "summary": { "fatal": 1, "warning": 0, "info": 0, "rulesFired": 211, "durationMs": 278 },
  "issues": [
    {
      "ruleId": "BR-02",
      "severity": "fatal",
      "profile": "en16931",
      "businessTerms": ["BT-1"],
      "location": { "xpath": "/*:Invoice[1]" },
      "message": "Račun mora sadržavati broj računa (BT-1).",
      "messages": {
        "en": "An Invoice shall have an Invoice number (BT-1).",
        "hr": "Račun mora sadržavati broj računa (BT-1).",
        "bs": "Faktura mora sadržavati broj fakture (BT-1).",
        "sr": "Faktura mora da sadrži broj fakture (BT-1)."
      }
    }
  ]
}
```

## Fields

| Field | Meaning |
|---|---|
| `valid` | `true` when there is no `fatal` finding. Warnings do not invalidate a document. |
| `document` | Header summary. For CII only `syntax` and `type` are populated. |
| `profiles[]` | Which profiles ran, and with which artefact version. |
| `summary.rulesFired` | Number of Schematron rules executed. |
| `issues[].ruleId` | Rule identifier, e.g. `BR-02`, `HR-BR-25`, `UBL-CR-006`. |
| `issues[].severity` | `fatal`, `warning` or `info`. |
| `issues[].profile` | Which profile reported the finding — `en16931`, `hr`, … |
| `issues[].businessTerms` | EN 16931 terms the rule refers to, e.g. `["BT-1"]`. |
| `issues[].location.xpath` | Location in the document. `line` and `column` are optional and currently not populated. |
| `issues[].message` | Message in the requested language, falling back to English. |
| `issues[].messages` | All available translations. |
| `issues[].hint` | Optional guidance. Also used when a national profile overrides a rule. |
| `truncated` | Present when `maxIssues` cut the list. Summary and `valid` are always computed from all findings. |

## Design notes

**`businessTerms` is a separate array.** Integrators map a finding onto a field
in their own ERP through the BT number, without parsing message text. In
practice this is the most useful part of the report.

**Both `message` and `messages`.** `message` is the already-resolved language,
which is what most callers want. `messages` exists for interfaces that pick the
language themselves, and saves a second call.

**`profile` on every finding.** When EN 16931 and a national CIUS run together,
you need to know whose rule failed — national and European problems are fixed
differently.

**`profiles[]` carries the artefact version.** The same document validated
against a different rule version yields a different result. Without this the
report is neither reproducible nor usable as an audit trail.

**`maxIssues` never changes the verdict.** The summary and `valid` are computed
from every finding; the option only shortens the list, and sets `truncated`.
Deriving the verdict from a truncated list would silently turn large invalid
documents into valid ones — exactly where a limit gets used.

**A failed assertion without `@flag` is fatal.** Schematron makes the flag
optional. Treating an unflagged failure as informational would let any profile
whose rules omit it report a broken document as valid.

**`rulesFired` is a sanity check.** A suspiciously low number means the document
never went through real validation — usually a wrong namespace — rather than
that it is correct.

**Overridden rules are not removed.** When a national CIUS requires an element
that a CEN syntax rule forbids, the finding stays in the report as `info`, with
a `hint` naming the profile that overrides it. Hiding it would leave no way to
see why the profiles disagree.

## Stability

- New optional fields — minor change, `reportVersion` stays the same.
- Changed meaning, removed field or changed type — `reportVersion` 2.0.
- New values for `severity`, `syntax` or `profile` — minor. Clients must
  tolerate values they do not recognise.
