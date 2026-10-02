# Provjera u pregledniku (VF-06)

Mjeri da li službena pravila rade u pregledniku i koliko traju, prije nego
što se gradi web validator.

## Pokretanje

1. Preuzmi **SaxonJS 2.7** sa saxonica.com (Download → SaxonJS) i kopiraj
   `SaxonJS2.rt.js` u ovaj folder. Datoteka nije na npm-u (tamo je samo
   verzija za Node) i nije u repou.
2. Pripremi pravila, ako već nisu tu:
   ```
   npm run prepare:sef
   ```
3. Pokreni server iz korijena repoa i otvori stranicu:
   ```
   python3 -m http.server 8000
   ```
   http://localhost:8000/tools/browser-check/
4. Za mobitel: otvori `http://<IP računara>:8000/tools/browser-check/` na
   istoj Wi-Fi mreži.

Kopiraj ispis i pošalji ga nazad.

## Licenca

SaxonJS je vlasništvo Saxonica Ltd. Licenca dozvoljava distribuciju
nepromijenjenog `SaxonJS2.rt.js` kao dijela aplikacije koja ga koristi, uz
navođenje autorskih prava. Zato se ne commita u repo.
