// ════════════════════════════════════════════════════════
//  sPiccioli! — api.js
//  Layer dati della cassa: caricamento, realtime, coda, azioni.
// ════════════════════════════════════════════════════════

var categorieCassa = [];
var chiusureCassa = [];

function dotC(cls, txt){
  var d = document.getElementById("cassa-dot");
  var t = document.getElementById("cassa-sync");
  if(d) d.className = "sync-dot" + (cls ? " "+cls : "");
  if(t) t.textContent = txt || "";
}

async function apriCassa(id){
  cassaCorrente = CASSE.find(function(c){ return c.id === id; });
  if(!cassaCorrente) return;
  mostraSchermata("cassa-screen");
  intestaCassa();
  skeletonsCassa();
  await caricaCassa();
  switchCassaTab("conti");
  initRealtimeCassa();
  if(getCoda().length) flushCoda();
}

async function caricaCassa(){
  dotC("", "Carico…");
  try{
    // TUTTI i membri: gli attivi servono ai calcoli, i rimossi a mostrare i nomi nello storico
    var rm = await sb.from("membri").select("*, profili(nome)")
      .eq("cassa_id", cassaCorrente.id)
      .order("created_at", { ascending: true });
    if(rm.error) return gestisciErroreCassa(rm.error);
    membriTutti    = rm.data || [];
    membriCorrente = membriTutti.filter(function(m){ return m.attivo; });

    var rmov = await sb.from("movimenti")
      .select("*, movimento_paganti(*), movimento_quote(*)")
      .eq("cassa_id", cassaCorrente.id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });
    if(rmov.error) return gestisciErroreCassa(rmov.error);

    S.movimenti = (rmov.data || []).map(function(m){
      m.paganti = m.movimento_paganti || [];
      m.quote   = m.movimento_quote   || [];
      return m;
    });

    var rcat = await sb.from("categorie").select("*")
      .eq("cassa_id", cassaCorrente.id).order("ordine").order("nome");
    categorieCassa = rcat.data || [];

    if(cassaCorrente.tipo === "coppia"){
      var rch = await sb.from("chiusure_coppia").select("*")
        .eq("cassa_id", cassaCorrente.id)
        .order("seq", { ascending: false });
      chiusureCassa = rch.data || [];
    } else {
      chiusureCassa = [];
    }

    dotC("ok", "Sincronizzata");
    aggiornaBadgeCoda();
    renderCassa();
  }catch(e){
    dotC("err", "Offline");
  }
}

function gestisciErroreCassa(err){
  if(errDiRete(err)){ dotC("err", "Offline"); return; }
  var msg = (err && err.message) || "";
  if(msg.indexOf("JWT") > -1 || err.code === "PGRST301"){
    sb.auth.signOut().then(function(){ location.reload(); });
    return;
  }
  dotC("err", "Errore");
  console.error("Supabase:", err);
}
function errDiRete(err){
  var msg = ((err && err.message) || "").toLowerCase();
  return !navigator.onLine || msg.indexOf("fetch") > -1 || msg.indexOf("network") > -1;
}

// ── REALTIME ──
var _rtCassa = null, _rtTimer = null;
function initRealtimeCassa(){
  chiudiRealtimeCassa();
  _rtCassa = sb.channel("cassa-" + cassaCorrente.id)
    .on("postgres_changes", { event: "*", schema: "public" }, function(){
      clearTimeout(_rtTimer);
      _rtTimer = setTimeout(function(){ if(cassaCorrente) caricaCassa(); }, 700);
    })
    .subscribe();
}
function chiudiRealtimeCassa(){
  if(_rtCassa){ sb.removeChannel(_rtCassa); _rtCassa = null; }
}

// ── MAPPA AZIONI → QUERY ──
async function runAction(p){
  var r;
  switch(p.action){
    case "addMovimento":
      r = await sb.rpc("aggiungi_movimento", {
        p_cassa: p.cassa, p_tipo: p.tipo || "spesa", p_descrizione: p.descrizione,
        p_importo: p.importo, p_valuta: p.valuta || "EUR", p_tasso: p.tasso || 1,
        p_metodo: p.metodo || "equo", p_data: p.data, p_creato_da: p.creatoDa,
        p_paganti: p.paganti, p_quote: p.quote, p_categoria: p.categoria || null
      });
      break;
    case "deleteMovimento":
      r = await sb.from("movimenti").delete().eq("id", p.id);
      break;
    default:
      return "ok";
  }
  if(r && r.error) throw r.error;
  return "ok";
}

async function post(payload){
  try{
    return await runAction(payload);
  }catch(e){
    if(errDiRete(e)){
      accodaOperazione(payload);
      dotC("err", "Offline — in attesa");
      throw e;
    }
    if(((e && e.message) || "").indexOf("JWT") > -1){
      sb.auth.signOut().then(function(){ location.reload(); });
    }
    console.error("Azione fallita:", payload.action, e);
    throw e;
  }
}

// ── CODA OFFLINE ──
var CODA_KEY = "spiccioli_coda";
function getCoda(){ try{ return JSON.parse(localStorage.getItem(CODA_KEY) || "[]"); }catch(e){ return []; } }
function setCoda(arr){ try{ localStorage.setItem(CODA_KEY, JSON.stringify(arr)); }catch(e){} }
function accodaOperazione(payload){ var coda = getCoda(); coda.push(payload); setCoda(coda); aggiornaBadgeCoda(); }
function aggiornaBadgeCoda(){
  var n = getCoda().length;
  var t = document.getElementById("cassa-sync");
  if(n > 0 && t) t.textContent = n + " in attesa";
}
async function flushCoda(){
  var coda = getCoda();
  if(!coda.length) return;
  dotC("", "Invio in attesa…");
  while(coda.length){
    try{ await runAction(coda[0]); coda.shift(); setCoda(coda); }
    catch(e){
      if(errDiRete(e)){ aggiornaBadgeCoda(); return; }
      console.error("Operazione scartata:", coda[0].action, e);
      coda.shift(); setCoda(coda);
    }
  }
  setCoda([]);
  caricaCassa();
}
window.addEventListener("online", function(){ if(cassaCorrente) flushCoda(); });
