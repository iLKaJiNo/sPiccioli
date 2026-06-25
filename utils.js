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
var SCHERMATE = ["auth-screen", "casse-screen", "cassa-screen"];
function mostraSchermata(id){
  SCHERMATE.forEach(function(s){
    var el = document.getElementById(s);
    if(el) el.classList.toggle("attiva", s === id);
  });
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
