# sPiccioli!
Un'app per dividere le spese senza impazzire. Scegli tra fondo comune o calcolo dei debiti 1-a-1. Pareggia i conti e metti via gli spiccioli. Costruita in Vanilla JS e Supabase.

# 🫙 sPiccioli!
*Pari & Patta, senza litigare (o quasi).*

**sPiccioli!** è una Progressive Web App (PWA) progettata per rivoluzionare la gestione delle spese condivise tra partner, coinquilini e gruppi di amici. Lontana dai classici fogli di calcolo freddi e ansiogeni, sPiccioli unisce un'infrastruttura di calcolo solida a un'interfaccia reattiva, ironica e... apertamente giudicante.

## 🚀 Il Concetto: Due Anime, Una Sola App
A differenza delle classiche app sul mercato, sPiccioli non ti obbliga a scegliere un solo stile di convivenza economica. Offre due motori contabili distinti:

1. **Cassa Comune:** Ideale per partner e conviventi storici. Gestisce un tesoretto centrale condiviso, monitorando il bilancio mensile complessivo e l'equilibrio dei versamenti.
2. **Debito Diretto:** Ideale per coinquilini e amici. Calcola i debiti 1-a-1, ottimizzando gli scambi per pareggiare i conti nel minor numero di transazioni possibili.

## ✨ "Silly" UI & Dinamiche
L'app non si limita a mostrarti i numeri, ma reagisce al tuo bilancio. Grazie a un set di animazioni CSS pure, l'interfaccia prende vita: se i tuoi debiti salgono troppo, il layout perde l'equilibrio, letteralmente. L'unico modo per rimettere dritto il viewport è saldare i conti e tornare *Pari & Patta*.

## 🛠 Tech Stack
*   **Frontend:** HTML5, Vanilla JavaScript (`app.js`), CSS Puro (con logiche di scaling in `rem` e `clamp()`).
*   **Backend & Database:** Supabase per sincronizzazione real-time e gestione dati condivisa.
*   **Architettura:** PWA (Progressive Web App) pronta per l'installazione su mobile, ottimizzata per touch e layout fluidi.
