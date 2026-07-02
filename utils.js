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
var S = { movimenti: [] };

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
