// ════════════════════════════════════════════════════════
//  sPiccioli! — utils.js
//  Costanti, client Supabase, stato globale, helper, schermate.
// ════════════════════════════════════════════════════════

// ── SUPABASE ──
var SUPABASE_URL = "https://gnxsysgdvwhgkcsoqrae.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdueHN5c2dkdndoZ2tjc29xcmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzMwNTUsImV4cCI6MjA5NjYwOTA1NX0.r47M9cd8MVEBsH6cPMJmXk-B0GWEINmpaqBEXhFgsHI";
var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── STATO GLOBALE ──────────────────────────────────────
var profiloUtente = null;
var CASSE = [];
var cassaCorrente = null;
var membriTutti = [];       // tutti i membri (anche rimossi) — per i nomi nello storico
var membriCorrente = [];    // membri ATTIVI — per saldi, form, conteggi
var S = { movimenti: [], saldiServer: null };   // saldiServer: mappa membro_id→saldo dalla RPC saldi_cassa (solo gruppo, movimenti paginati); null = non applicabile/non ancora caricata
var _movDelPending = {};    // id movimento → eliminazione in attesa di undo (il realtime non deve farla riapparire)

// ── SCHERMATE ──────────────────────────────────────────
var SCHERMATE = ["auth-screen", "casse-screen", "cassa-screen", "solo-screen"];
function mostraSchermata(id){
  SCHERMATE.forEach(function(s){
    var el = document.getElementById(s);
    if(el) el.classList.toggle("attiva", s === id);
  });
  // ── tema per schermata ──
  if(id === "cassa-screen"){
    document.body.setAttribute("data-tema", (cassaCorrente && cassaCorrente.tema) || "salvadanaio");
  } else if(id === "casse-screen" || id === "solo-screen"){
    document.body.setAttribute("data-tema", (profiloUtente && profiloUtente.tema) || "salvadanaio");
  } else {
    document.body.removeAttribute("data-tema");   // auth-screen → brand
  }
  if(typeof aggiornaThemeColor === "function") aggiornaThemeColor();
}

// ── HELPER DI FORMATO ──────────────────────────────────
function fmt(iso){
  if(!iso) return "";
  var d = new Date(iso);
  return isNaN(d) ? iso : String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0");
}
function fmtLong(iso){
  if(!iso) return "";
  var d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString("it-IT",{day:"numeric",month:"long",year:"numeric"});
}
function eur(n){
  return Math.abs(Math.round(n*100)/100).toFixed(2).replace(".",",")+"\u00a0\u20ac";
}
function etichettaChiusura(c){
  if(c.nome) return c.nome;
  if(c.mese) return new Date(c.mese).toLocaleDateString("it-IT",{month:"long",year:"numeric"});
  return fmt(c.chiusa_il || c.created_at);
}
function importoCon(n, valuta){
  var s = Math.abs(Math.round(n*100)/100).toFixed(2).replace(".",",");
  var simb = { EUR:"\u20ac", GBP:"\u00a3", USD:"$", CHF:"CHF" };
  return s + "\u00a0" + (simb[valuta] || valuta || "\u20ac");
}
function escapeHtml(s){
  return (s||"").replace(/[&<>"]/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];
  });
}

// ── MESSAGGI D'ERRORE UMANI ──
// Traduce l'errore Supabase (PostgREST/PostgreSQL/rete) in una frase leggibile.
// Usato al posto di "Errore: "+r.error.message nei toast/alert dei call-site .rpc e runAction.
function msgErrore(e){
  if(!e) return "Qualcosa è andato storto.";
  var c = e.code || "", m = e.message || "";
  if(c === "P0001") return m;                      // messaggi umani delle RPC
  if(c === "23505") return "Esiste già un elemento identico.";
  if(c === "23503") return "Operazione non possibile: elemento collegato mancante.";
  if(c === "42501" || (m && m.indexOf("permission denied") >= 0))
    return "Non hai i permessi per farlo.";
  if(m && (m.indexOf("Failed to fetch") >= 0 || m.indexOf("NetworkError") >= 0))
    return "Sei offline: riprova quando torna la rete.";
  return "Qualcosa è andato storto. Riprova.";
}

// ── Accordion / fisarmonica per liste lunghe (helper condivisi) ──
var ACCORDION_BTN_STYLE = "display:block;width:100%;background:var(--br-bg2);border:1px dashed var(--br-line);border-radius:10px;color:var(--br-dim);font-family:'Nunito',sans-serif;font-weight:700;font-size:.78rem;padding:7px 8px;margin:8px 0;cursor:pointer;";
function accordionAperto(key, def){
  try{ var v = localStorage.getItem(key); return v === null ? def : (v === "1"); }catch(e){ return def; }
}
function accordionToggle(boxId, btnId, key){
  var box = document.getElementById(boxId); if(!box) return;
  var btn = document.getElementById(btnId);
  var n = box.getAttribute("data-count") || "";
  var apri = box.getAttribute("data-open") !== "1";
  if(apri){
    box.style.maxHeight = box.scrollHeight + "px";
    box.setAttribute("data-open", "1");
    setTimeout(function(){ if(box.getAttribute("data-open") === "1") box.style.maxHeight = "none"; }, 360);
  } else {
    box.style.maxHeight = box.scrollHeight + "px";
    void box.offsetHeight;                       // forza reflow prima di collassare
    requestAnimationFrame(function(){ box.style.maxHeight = "0px"; });
    box.setAttribute("data-open", "0");
  }
  if(btn) btn.innerHTML = apri ? "▾ Nascondi le voci precedenti" : ("▸ Mostra le altre " + n + " voci");
  try{ localStorage.setItem(key, apri ? "1" : "0"); }catch(e){}
}

// ── MODALI BRAND (confermaBrand / promptBrand / alertBrand) ──
// Riusano #modal-brand (.modal-overlay/.br-modal/.m-btns) al posto di confirm()/prompt()/alert().
var _brandResolve = null;
function _brandClose(result){
  var ov = document.getElementById("modal-brand");
  if(ov) ov.classList.remove("attivo");
  var r = _brandResolve; _brandResolve = null;
  if(r) r(result);
}
function confermaBrand(opts){
  opts = opts || {};
  return new Promise(function(resolve){
    _brandResolve = resolve;
    document.getElementById("brand-titolo").textContent = opts.titolo || "";
    document.getElementById("brand-testo").innerHTML = opts.testo || "";
    document.getElementById("brand-input-wrap").style.display = "none";
    var cta = document.getElementById("brand-cta");
    cta.textContent = opts.cta || "Conferma";
    cta.className = "m-conferma" + (opts.danger ? " m-elimina" : "");
    cta.onclick = function(){ _brandClose(true); };
    var ann = document.getElementById("brand-annulla");
    ann.style.display = "";
    ann.textContent = opts.annulla || "Annulla";
    ann.onclick = function(){ _brandClose(false); };
    document.getElementById("modal-brand").classList.add("attivo");
  });
}
function promptBrand(opts){
  opts = opts || {};
  return new Promise(function(resolve){
    _brandResolve = resolve;
    document.getElementById("brand-titolo").textContent = opts.titolo || "";
    document.getElementById("brand-testo").innerHTML = opts.testo || "";
    document.getElementById("brand-input-wrap").style.display = "";
    var inp = document.getElementById("brand-input");
    inp.type = opts.tipo || "text";
    inp.placeholder = opts.placeholder || "";
    inp.value = opts.valore || "";
    var cta = document.getElementById("brand-cta");
    cta.textContent = opts.cta || "Salva";
    cta.className = "m-conferma";
    cta.onclick = function(){ _brandClose(inp.value); };
    var ann = document.getElementById("brand-annulla");
    ann.style.display = "";
    ann.textContent = "Annulla";
    ann.onclick = function(){ _brandClose(null); };
    document.getElementById("modal-brand").classList.add("attivo");
    setTimeout(function(){ inp.focus(); }, 100);
  });
}
function alertBrand(testo, titolo){
  return new Promise(function(resolve){
    _brandResolve = resolve;
    document.getElementById("brand-titolo").textContent = titolo || "";
    document.getElementById("brand-testo").innerHTML = testo || "";
    document.getElementById("brand-input-wrap").style.display = "none";
    var cta = document.getElementById("brand-cta");
    cta.textContent = "Ok";
    cta.className = "m-conferma";
    cta.onclick = function(){ _brandClose(true); };
    var ann = document.getElementById("brand-annulla");
    ann.style.display = "none";
    document.getElementById("modal-brand").classList.add("attivo");
  });
}

// Esc chiude la modale in cima (l'ultima nel DOM tra le attive = quella sopra).
// Tutte le chiudiX() si limitano a togliere .attivo, quindi è equivalente;
// solo il modal-brand deve risolvere la sua Promise (come il tap sullo sfondo).
document.addEventListener("keydown", function(e){
  if(e.key !== "Escape") return;
  var aperte = document.querySelectorAll(".modal-overlay.attivo");
  if(!aperte.length) return;
  var ov = aperte[aperte.length - 1];
  if(ov.id === "modal-brand"){ _brandClose(null); return; }
  ov.classList.remove("attivo");
});

// theme-color della barra di sistema allineato allo sfondo corrente
// (tema della cassa + luminosità); chiamato da mostraSchermata/cambiaTema/applicaLum.
function aggiornaThemeColor(){
  try{
    var meta = document.querySelector('meta[name="theme-color"]');
    if(!meta) return;
    var bg = getComputedStyle(document.body).backgroundColor;
    if(bg) meta.setAttribute("content", bg);
  }catch(e){}
}

// toast con bottone azione (es. «Annulla»): se l'utente non agisce entro ms,
// scatta onScadenza; se tocca il bottone, scatta onAzione. Usato per l'undo.
function toastAzione(msg, labelAzione, onAzione, onScadenza, ms){
  var t = document.createElement("div");
  t.className = "toast-info toast-azione";
  var s = document.createElement("span"); s.textContent = msg;
  var b = document.createElement("button"); b.type = "button"; b.textContent = labelAzione;
  t.appendChild(s); t.appendChild(b);
  document.body.appendChild(t);
  void t.offsetHeight;
  t.classList.add("show");
  var chiuso = false;
  function chiudi(){
    if(chiuso) return; chiuso = true;
    t.classList.remove("show");
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 300);
  }
  var timer = setTimeout(function(){ chiudi(); if(onScadenza) onScadenza(); }, ms || 5000);
  b.onclick = function(){ clearTimeout(timer); chiudi(); if(onAzione) onAzione(); };
}

// ── ACCESSIBILITÀ MODALI ──
// role/aria sul guscio condiviso, focus dentro all'apertura, Tab intrappolato,
// focus restituito alla chiusura. Enter/Spazio attivano le righe role="button".
function _focusabili(box){
  return Array.prototype.filter.call(
    box.querySelectorAll('button, input, select, textarea, a[onclick], [tabindex="0"]'),
    function(el){ return !el.disabled && el.offsetParent !== null; }
  );
}
(function(){
  if(typeof MutationObserver === "undefined" || !document.querySelectorAll) return;
  var overlays = document.querySelectorAll(".modal-overlay");
  overlays.forEach(function(ov){
    var box = ov.querySelector(".br-modal");
    if(box){ box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); }
  });
  var obs = new MutationObserver(function(muts){
    muts.forEach(function(mu){
      var ov = mu.target;
      var attivo = ov.classList.contains("attivo");
      var era = (mu.oldValue || "").indexOf("attivo") > -1;
      if(attivo && !era){
        ov._prevFocus = document.activeElement;
        setTimeout(function(){
          if(!ov.classList.contains("attivo")) return;
          if(ov.contains(document.activeElement)) return;   // l'open ha già messo il focus su un input
          var f = _focusabili(ov);
          if(f.length) f[0].focus();
        }, 150);
      } else if(!attivo && era && ov._prevFocus){
        var prev = ov._prevFocus; ov._prevFocus = null;
        if(document.body.contains(prev)){ try{ prev.focus(); }catch(e){} }
      }
    });
  });
  overlays.forEach(function(ov){
    obs.observe(ov, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Tab") return;
    var aperte = document.querySelectorAll(".modal-overlay.attivo");
    if(!aperte.length) return;
    var ov = aperte[aperte.length - 1];
    var f = _focusabili(ov);
    if(!f.length) return;
    var prima = f[0], ultima = f[f.length - 1];
    if(e.shiftKey && (document.activeElement === prima || !ov.contains(document.activeElement))){
      e.preventDefault(); ultima.focus();
    } else if(!e.shiftKey && (document.activeElement === ultima || !ov.contains(document.activeElement))){
      e.preventDefault(); prima.focus();
    }
  });
})();
document.addEventListener("keydown", function(e){
  if(e.key !== "Enter" && e.key !== " ") return;
  var el = e.target;
  if(el && el.getAttribute && el.getAttribute("role") === "button"
     && el.tagName !== "BUTTON" && el.tagName !== "INPUT"){
    e.preventDefault(); el.click();
  }
});

// toast informativo non-bloccante (auto-dismiss)
function toastInfo(msg){
  try{
    var t = document.createElement("div");
    t.className = "toast-info";
    t.textContent = msg;
    document.body.appendChild(t);
    // forza reflow poi mostra
    void t.offsetHeight;
    t.classList.add("show");
    setTimeout(function(){
      t.classList.remove("show");
      setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 2600);
  }catch(e){}
}

// ── NUDGE PROMEMORIA CHIUSURA (banner "registro multi-mese") ──
var _nudgeDismiss = {};   // per-sessione: chiave → true
function registroMultiMese(righe, campoData){
  var mesi = {};
  (righe||[]).forEach(function(r){
    var d = r[campoData]; if(!d) return;
    mesi[String(d).slice(0,7)] = true;   // "YYYY-MM"
  });
  return Object.keys(mesi).length > 1;
}

// ── HELPER SALDI (net-balance, valuta base) ──
function mioMembro(){
  return membriCorrente.find(function(m){ return m.user_id === (profiloUtente && profiloUtente.id); });
}
function calcolaSaldi(){
  var saldi = {};
  membriCorrente.forEach(function(m){ saldi[m.id] = 0; });   // solo membri attivi
  (S.movimenti || []).forEach(function(mov){
    var t = parseFloat(mov.tasso_cambio) || 1;
    (mov.paganti || []).forEach(function(p){
      if(saldi[p.membro_id] !== undefined) saldi[p.membro_id] += (parseFloat(p.importo)||0) * t;
    });
    (mov.quote || []).forEach(function(q){
      if(saldi[q.membro_id] !== undefined) saldi[q.membro_id] -= (parseFloat(q.importo)||0) * t;
    });
  });
  Object.keys(saldi).forEach(function(k){ saldi[k] = Math.round(saldi[k]*100)/100; });
  return saldi;
}
// Punto unico di verità per i saldi mostrati (Conti / chi-deve-a-chi / settle / badge in-pari):
// usa i saldi esatti del server (S.saldiServer, popolati da caricaCassa per i gruppi con
// movimenti paginati) quando presenti, altrimenti ricade sul calcolo client calcolaSaldi().
function saldiCorrenti(){
  return S.saldiServer || calcolaSaldi();
}
function dividiEquo(importo, n){
  var cent  = Math.round(importo * 100);
  var base  = Math.floor(cent / n);
  var resto = cent - base * n;
  var out = [];
  for(var i=0; i<n; i++){ out.push((base + (i < resto ? 1 : 0)) / 100); }
  return out;
}
function ripartisciCentesimi(totCent, pesi){
  var somma = pesi.reduce(function(a,b){ return a+b; }, 0);
  if(somma <= 0) return pesi.map(function(){ return 0; });
  var grezzi = pesi.map(function(p){ return totCent * p / somma; });
  var base   = grezzi.map(Math.floor);
  var resto  = totCent - base.reduce(function(a,b){ return a+b; }, 0);
  var ord = grezzi
    .map(function(g, i){ return { i: i, frac: g - Math.floor(g) }; })
    .sort(function(a,b){ return b.frac - a.frac; });
  for(var k = 0; k < resto; k++){ base[ord[k].i]++; }
  return base;
}
function simplificaDebiti(saldi){
  var cred = [], deb = [];
  membriCorrente.forEach(function(m){
    var v = Math.round((saldi[m.id]||0)*100);
    if(v > 0) cred.push({ id:m.id, v:v });
    else if(v < 0) deb.push({ id:m.id, v:-v });
  });
  cred.sort(function(a,b){ return b.v-a.v; });
  deb.sort(function(a,b){ return b.v-a.v; });
  var res = [], i=0, j=0;
  while(i < deb.length && j < cred.length){
    var pay = Math.min(deb[i].v, cred[j].v);
    if(pay > 0) res.push({ da:deb[i].id, a:cred[j].id, importo:pay/100 });
    deb[i].v -= pay; cred[j].v -= pay;
    if(deb[i].v === 0) i++;
    if(cred[j].v === 0) j++;
  }
  return res;
}
