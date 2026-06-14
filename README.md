<p align="center">
  <img src="./icon-512.png" alt="sPiccioli!" width="120">
</p>

<h1 align="center">sPiccioli!</h1>

> Al mondo d'oggi ormai abbiamo controllo solo sulle piccole cose, ma spesso da
> piccole cose nascono grandi amori, grandi litigi, problemi o situazioni
> fantastiche. **sPiccioli!** ti aiuta a tenere da conto le piccole Spese, i
> *"Piccioli"* …che tu sia da solo, in due, o in un gruppo scellerato di persone.
> L'importante è rimanere **Silly** per dare un giusto peso alle cose piccole ma
> importanti.

---

## Cos'è

sPiccioli! è un'app di **contabilità condivisa** per gestire le spese di casa,
di coppia, di un viaggio o di un gruppo. Una *cassa* raccoglie le spese di chi
ne fa parte; l'app tiene i conti e ti dice chi è in pari e chi no.

Funziona da **1 a ~20 persone**, è una **PWA** (si installa come app, va anche
offline), non ha pubblicità e i dati vivono su un database che controlli tu.

## Le due anime

Ogni cassa sceglie come fare i conti:

- **Cassa comune** — il saldo è una *bilancia* tra i membri (quanto hai messo
  rispetto a quanto ti spetta). C'è anche la *modalità grezza* a due, che mostra
  il puro divario di spesa.
- **Debiti diretti** — *chi deve cosa a chi*, alla Splitwise, con i pagamenti
  semplificati al minimo numero di rimborsi.

Si passa dai conti al pareggio con un tocco (**settle-up**), anche parziale.

## Funzioni

- Spese con **un pagante o più paganti**
- Divisione **equa, per importi esatti, per percentuali o per quote pesate**
- **Multivaluta**: spese in valuta estera con tasso del giorno *congelato*
- Accesso con **email + password**, ingresso in una cassa tramite **codice**
- Gestione membri: **rinomina, rimuovi, ruoli admin, codice rigenerabile**
- **Tempo reale** tra i membri e **funzionamento offline** con coda
- **Temi**: orsi, pesci, west, alieni, jungle, flamingo e il classico
  **salvadanaio** 🐷 — più il tocco *Silly*

## Stack

- **Frontend**: HTML / CSS / JavaScript vanilla, nessun framework
- **PWA**: service worker per cache e funzionamento offline
- **Backend**: [Supabase](https://supabase.com) — Postgres, Auth, Realtime,
  funzioni SQL atomiche, Row Level Security
- **Hosting**: GitHub Pages

## Struttura del progetto

```
index.html        struttura e schermate (auth, casse, cassa) + modali
app.js            avvio
utils.js          stato globale + motore di calcolo (saldi, split, debiti)
api.js            dati, realtime, coda offline, azioni verso Supabase
auth.js           login/registrazione, lista casse, crea/unisci
cassa.js          UI dentro la cassa (tab, saldi, movimenti, membri)
auth.css          stile brand (login, casse, modali) + variabili colore
cassa.css         stile della schermata cassa
sw.js             service worker (cache)
manifest.json     identità PWA
spiccioli.svg     logo
```

Lo schema dati e la logica server (tabelle, RLS, funzioni `crea_cassa`,
`unisciti_a_cassa`, `aggiungi_movimento`, …) vivono su Supabase, non nel repo.

## Stato

In sviluppo attivo. Già funzionanti: account reali, casse multiple, spese con
split avanzato e multivaluta, modalità *comune*/*diretti* (+ grezza), settle-up,
gestione membri, tempo reale e coda offline.

In arrivo: archivi mensili e spese fisse/previste per le casse di coppia, temi
multipli, tab Lista e Note, grafici di spesa, slide di benvenuto e help.

## Filosofia

Le grandi piattaforme inseguono funzioni su funzioni. sPiccioli! va dall'altra
parte: poche cose, fatte bene, con un po' di leggerezza. Perché i piccioli sono
piccoli, ma le persone con cui li dividi no.

---

*Resta Silly.* 🐷
