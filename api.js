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
  document.body.setAttribute("data-tema", cassaCorrente.tema || "salvadanaio");
  mostraSchermata("cassa-screen");
  intestaCassa();
  var _br = document.getElementById("btn-ricorrenti-cassa");
  if(_br) _br.style.display = (cassaCorrente.tipo === "coppia") ? "block" : "none";
  if(cassaCorrente.tipo === "coppia" && navigator.onLine){
    try{
      var rmat = await sb.rpc("materializza_ricorrenti_cassa", { p_cassa_id: cassaCorrente.id });
      var n = (rmat && rmat.data && rmat.data.emesse) || 0;
      if(n > 0) toastInfo("🔁 " + n + (n===1 ? " spesa ricorrente registrata" : " spese ricorrenti registrate"));
    }catch(e){ /* non bloccare l'apertura della cassa */ }
  }
  skeletonsCassa();
  await caricaCassa();
  switchCassaTab("conti");
  initRealtimeCassa();
  if(getCoda().length) flushCoda();
}

// ── A3 · PAGINAZIONE MOVIMENTI (gruppi grandi) ──
// Solo tipo='gruppo' limita alla prima pagina (ULTIMI 200): i gruppi accumulano
// tanti movimenti e non archiviano a mese. La coppia carica tutto (net-balance
// esatto: vedi nota su calcolaSaldi più sotto e nel REPORT).
var MOV_PAGINA = 200;
function _queryMovimenti(from, to){
  var q = sb.from("movimenti")
    .select("*, movimento_paganti(*), movimento_quote(*)")
    .eq("cassa_id", cassaCorrente.id)
    .order("data", { ascending: false })          // desc: la vista mostra i più recenti in cima
    .order("created_at", { ascending: false });
  if(from != null && to != null) q = q.range(from, to);
  return q;
}

async function caricaCassa(){
  dotC("", "Carico…");
  try{
    var _movLimitata = (cassaCorrente.tipo === "gruppo");
    // Query indipendenti in parallelo: su rete mobile dimezza il tempo di sync.
    // TUTTI i membri: gli attivi servono ai calcoli, i rimossi a mostrare i nomi nello storico
    var q = await Promise.all([
      sb.from("membri").select("*, profili(nome)")
        .eq("cassa_id", cassaCorrente.id)
        .order("created_at", { ascending: true }),
      _movLimitata ? _queryMovimenti(0, MOV_PAGINA - 1) : _queryMovimenti(),
      sb.from("categorie").select("*")
        .eq("cassa_id", cassaCorrente.id).order("ordine").order("nome"),
      (cassaCorrente.tipo === "coppia")
        ? sb.from("chiusure_coppia").select("*")
            .eq("cassa_id", cassaCorrente.id)
            .order("seq", { ascending: false })
        : Promise.resolve({ data: [] }),
      sb.from("lista_cassa").select("*")
        .eq("cassa_id", cassaCorrente.id).order("creata_il", { ascending: true }),
      sb.from("note_cassa").select("*")
        .eq("cassa_id", cassaCorrente.id).order("creata_il", { ascending: false }),
      caricaRicorrentiCassa()
    ]);
    var rm = q[0], rmov = q[1], rcat = q[2], rch = q[3], rlista = q[4], rnote = q[5];
    if(rm.error) return gestisciErroreCassa(rm.error);
    membriTutti    = rm.data || [];
    membriCorrente = membriTutti.filter(function(m){ return m.attivo; });

    if(rmov.error) return gestisciErroreCassa(rmov.error);
    var _movRaw = rmov.data || [];
    // Il realtime richiama caricaCassa(): ricarica sempre la PRIMA pagina, quindi
    // eventuali pagine "Carica precedenti" già aperte si richiudono. Accettabile.
    S.movCaricati       = _movRaw.length;                          // righe grezze già scaricate (offset paginazione)
    S.movimentiParziali = _movLimitata && (_movRaw.length === MOV_PAGINA);
    S.movimenti = _movRaw.map(function(m){
      m.paganti = m.movimento_paganti || [];
      m.quote   = m.movimento_quote   || [];
      return m;
    }).filter(function(m){ return !_movDelPending[m.id]; });   // undo in corso: non farle riapparire

    if(rcat.error) return gestisciErroreCassa(rcat.error);
    categorieCassa = rcat.data || [];

    chiusureCassa = rch.data || [];

    if(rlista.error) return gestisciErroreCassa(rlista.error);
    S.lista = rlista.data || [];

    if(rnote.error) return gestisciErroreCassa(rnote.error);
    S.note = rnote.data || [];

    dotC("ok", "Sincronizzata");
    aggiornaBadgeCoda();
    renderCassa();
  }catch(e){
    dotC("err", "Offline");
  }
}

// ── A3 · «Carica precedenti»: appende la pagina successiva a S.movimenti ──
// range 200-399, poi 400-599… partendo dalle righe già scaricate (S.movCaricati).
var _movPaginaInCorso = false;
async function caricaAltriMovimenti(){
  if(_movPaginaInCorso || !cassaCorrente || !S.movimentiParziali) return;
  _movPaginaInCorso = true;
  var btn = document.getElementById("mv-piu-btn");
  if(btn){ btn.disabled = true; btn.textContent = "⏳ Carico…"; }
  try{
    var from = S.movCaricati || S.movimenti.length;
    var r = await _queryMovimenti(from, from + MOV_PAGINA - 1);
    if(r.error){ toastInfo(msgErrore(r.error)); return; }
    var raw = r.data || [];
    S.movCaricati       = from + raw.length;
    S.movimentiParziali = (raw.length === MOV_PAGINA);
    var nuovi = raw.map(function(m){
      m.paganti = m.movimento_paganti || [];
      m.quote   = m.movimento_quote   || [];
      return m;
    }).filter(function(m){ return !_movDelPending[m.id]; });
    S.movimenti = (S.movimenti || []).concat(nuovi);
    renderMovimenti();
    renderSaldi();   // i saldi in vista includono ora anche le pagine caricate
  }catch(e){
    if(errDiRete(e)) toastInfo("Sei offline: riprova quando torna la rete.");
    else { console.error("Carica precedenti fallito:", e); toastInfo("Qualcosa è andato storto. Riprova."); }
  }finally{
    _movPaginaInCorso = false;
    // se il bottone è ancora lì (errore, o pagina non finita) riportalo cliccabile
    var b = document.getElementById("mv-piu-btn");
    if(b){ b.disabled = false; b.textContent = "⏳ Carica precedenti"; }
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
  var rid = cassaCorrente.id;
  var ricarica = function(){
    clearTimeout(_rtTimer);
    _rtTimer = setTimeout(function(){ if(cassaCorrente) caricaCassa(); }, 700);
  };
  var ch = sb.channel("cassa-" + rid);
  ["movimenti","membri","categorie","chiusure_coppia","ricorrenti","lista_cassa","note_cassa"].forEach(function(tab){
    ch.on("postgres_changes",
      { event: "*", schema: "public", table: tab, filter: "cassa_id=eq." + rid },
      ricarica);
  });
  _rtCassa = ch.subscribe();
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
    case "addListaItem":
      r = await sb.from("lista_cassa").insert({ id:p.id, cassa_id:p.cassa_id, testo:p.testo, quantita:p.quantita||null, autore:p.autore });
      break;
    case "toggleListaItem":
      r = await sb.from("lista_cassa").update({ completata:p.completata }).eq("id", p.id);
      break;
    case "checkAllLista":
      r = await sb.from("lista_cassa").update({ completata:p.completata }).eq("cassa_id", p.cassa_id).eq("completata", !p.completata);
      break;
    case "deleteListaItem":
      r = await sb.from("lista_cassa").delete().eq("id", p.id);
      break;
    case "clearListaItems":
      var _q = sb.from("lista_cassa").delete().eq("cassa_id", p.cassa_id);
      if(p.soloCompletate) _q = _q.eq("completata", true);
      r = await _q;
      break;
    case "addNota":
      r = await sb.from("note_cassa").insert({ id:p.id, cassa_id:p.cassa_id, testo:p.testo, autore:p.autore });
      break;
    case "editNota":
      r = await sb.from("note_cassa").update({ testo:p.testo, aggiornata_il:new Date().toISOString() }).eq("id", p.id);
      break;
    case "deleteNota":
      r = await sb.from("note_cassa").delete().eq("id", p.id);
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
      return "queued";
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
      var _desc = coda[0].descrizione ? " («" + coda[0].descrizione + "»)" : "";
      toastInfo("⚠️ Un'operazione salvata offline" + _desc + " non è passata ed è stata scartata.");
      coda.shift(); setCoda(coda);
    }
  }
  setCoda([]);
  caricaCassa();
}
window.addEventListener("online", function(){ if(cassaCorrente) flushCoda(); });
