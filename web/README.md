# Web validator

A static page that validates an e-invoice in the browser. Paste XML or drop a
file and get the findings in Croatian, Bosnian, Serbian or English. The
invoice never leaves the browser: there is no backend.

It runs the same pipeline as `validate()` (`runValidation` from
`verifaktura/portable`), so the findings match the Node library.

## Build

```bash
npm run prepare:sef     # validation artefacts
npm run build           # packages
npm run build:web       # -> web/dist
npm run check:web       # headless Chrome: findings equal Node's
```

`build:web` downloads SaxonJS 2.7 from saxonica.com once (cached in
`web/.cache`) and checks its sha256. SaxonJS 2 for the browser is not on npm.

`check:web` needs Chrome. It looks in the usual macOS and Linux locations, or
set `CHROME=/path/to/chrome`.

## Hosting

`web/dist` is plain static files. Two requirements for the host:

- **Compress `.json`.** The rules are 6.7 MB raw and about 72 KB with brotli.
  Without compression the first check downloads the full size.
- **Serve `.json` as `application/json`.** The rule catalogue is imported as a
  JSON module, which browsers load only with that MIME type.

The page sets a strict Content-Security-Policy in a `<meta>` tag. If the host
adds its own CSP header, it must allow `'self'` for scripts, styles and
`connect-src`.

## Licences shown on the page

The footer credits CEN/TC 434 (EUPL 1.2), the Croatian Tax Administration, and
Saxonica, whose licence ships as `vendor/SaxonJS-LICENSE.txt`. Distribution of
the unmodified `SaxonJS2.rt.js` inside an application is allowed under that
licence.
