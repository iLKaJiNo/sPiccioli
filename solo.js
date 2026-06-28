// ════════════════════════════════════════════════════════
//  sPiccioli! — solo.js
//  Modalità Solo: registro personale (entrate/uscite) + categorie.
//  Tabelle solo_voci / solo_categorie (RLS user-scoped, user_id default
//  auth.uid()). Non è una cassa: schermata a sé, sempre disponibile.
//  Saldo = entrate − uscite (nessun saldo concatenato).
// ════════════════════════════════════════════════════════

// ── STATO ──
var soloVoci      = [];
var soloCategorie = [];
var _voceTipo     = "uscita";
var _soloCatEditId = null;

// ── NAVIGAZIONE ──
async function apriSolo(){
  mostraSchermata("solo-screen");
  await caricaSolo();
  initRealtimeSolo();
}
function tornaDaSolo(){
  chiudiRealtimeSolo();
  mostraSchermata("casse-screen");
}

// ── CARICAMENTO ──
// niente .eq(user_id): la RLS filtra già le proprie righe.
async function caricaSolo(){
  var rv = await sb.from("solo_voci").select("*")
    .order("data", { ascending: false }).order("created_at", { ascending: false });
  soloVoci = rv.data || [];
  var rc = await sb.from("solo_categorie").select("*").order("ordine").order("nome");
  soloCategorie = rc.data || [];
  renderSolo();
}

// icona della categoria Solo per nome; fallback morbido se la cat è stata eliminata
function iconaSoloCat(nome){
  if(!nome) return "";
  var c = (soloCategorie || []).find(function(x){ return x.nome === nome; });
  return (c && c.icona) || "📌";
}

// ── RENDER ──
function renderSolo(){
  // saldo = entrate − uscite
  var saldo = 0;
  (soloVoci || []).forEach(function(v){
    var imp = parseFloat(v.importo) || 0;
    saldo += (v.tipo === "entrata") ? imp : -imp;
  });
  saldo = Math.round(saldo * 100) / 100;
  var elS = document.getElementById("solo-saldo");
  if(elS){
    var seg = saldo < -0.005 ? "−" : "";
    elS.textContent = seg + eur(saldo);                 // eur() restituisce già il valore assoluto
    elS.className   = "solo-saldo-val " + (saldo < -0.005 ? "neg" : "pos");
  }

  // registro
  var wrap = document.getElementById("solo-lista");
  if(!wrap) return;
  if(!soloVoci.length){
    wrap.innerHTML = '<div class="mv-empty">Il tuo registro è ancora vuoto.<br>Aggiungi la prima voce! 👆</div>';
    return;
  }
  wrap.innerHTML = soloVoci.map(function(v){
    var entrata = v.tipo === "entrata";
    var imp     = parseFloat(v.importo) || 0;
    var ico     = v.categoria ? iconaSoloCat(v.categoria) : (entrata ? "💰" : "💸");
    var testo   = v.nota || v.categoria || (entrata ? "Entrata" : "Uscita");
    var sotto   = (v.nota && v.categoria) ? v.categoria : "";   // se la nota fa da titolo, la categoria va nel meta
    var meta    = fmt(v.data) + (sotto ? " · " + escapeHtml(sotto) : "");
    var seg     = entrata ? "+ " : "− ";
    var cls     = entrata ? "voce-entrata" : "voce-uscita";

    // voci da chiusura mensile (S7c): badge 🔒, non eliminabili
    var azione = (v.origine === "chiusura")
      ? '<span class="voce-lock" title="Da chiusura mensile">🔒</span>'
      : '<button class="mv-del" onclick="eliminaVoce(\'' + v.id + '\')" title="Elimina">×</button>';

    return '<div class="mv-item">'
      +   '<div class="mv-main">'
      +     '<div class="mv-desc">' + ico + ' ' + escapeHtml(testo) + '</div>'
      +     '<div class="mv-meta">' + meta + '</div>'
      +   '</div>'
      +   '<div class="mv-imp ' + cls + '">' + seg + importoCon(imp, "EUR") + '</div>'
      +   azione
      + '</div>';
  }).join("");
}

// ════════════════════════════════════════════════════════
//  NUOVA VOCE
// ════════════════════════════════════════════════════════
function apriNuovaVoce(){
  setVoceTipo("uscita");
  popolaVoceCategoria();
  document.getElementById("voce-imp").value  = "";
  document.getElementById("voce-nota").value = "";
  document.getElementById("voce-data").value = new Date().toISOString().slice(0,10);
  voceErrore("");
  document.getElementById("modal-voce").classList.add("attivo");
  setTimeout(function(){ document.getElementById("voce-imp").focus(); }, 100);
}
function chiudiNuovaVoce(){ document.getElementById("modal-voce").classList.remove("attivo"); }
function voceErrore(m){ document.getElementById("voce-error").textContent = m || ""; }

function setVoceTipo(t){
  _voceTipo = t;
  document.querySelectorAll("#voce-tipo-seg .split-btn").forEach(function(b){
    b.classList.toggle("attivo", b.getAttribute("data-t") === t);
  });
}

// riempie il select categoria (facoltativa) della voce
function popolaVoceCategoria(){
  var sel = document.getElementById("voce-categoria");
  if(!sel) return;
  var prec = sel.value;
  var html = '<option value="">— nessuna —</option>';
  (soloCategorie || []).forEach(function(c){
    html += '<option value="' + escapeHtml(c.nome) + '">' + escapeHtml((c.icona || "📌") + " " + c.nome) + '</option>';
  });
  sel.innerHTML = html;
  if(prec && (soloCategorie || []).some(function(c){ return c.nome === prec; })) sel.value = prec;
}

async function salvaVoce(){
  var imp  = parseFloat(document.getElementById("voce-imp").value);
  var cat  = document.getElementById("voce-categoria").value;
  var nota = document.getElementById("voce-nota").value.trim();
  var data = document.getElementById("voce-data").value || new Date().toISOString().slice(0,10);
  if(!imp || imp <= 0){ voceErrore("Inserisci un importo valido."); return; }

  // user_id arriva dal default (auth.uid()) lato Supabase
  var r = await sb.from("solo_voci").insert({
    tipo: _voceTipo, importo: imp,
    categoria: cat || null, nota: nota || null, data: data
  });
  if(r.error){ alert("Errore: " + r.error.message); return; }
  chiudiNuovaVoce();
  await caricaSolo();
}

async function eliminaVoce(id){
  if(!confirm("Eliminare questa voce?")) return;
  var r = await sb.from("solo_voci").delete().eq("id", id);
  if(r.error){ alert("Errore: " + r.error.message); return; }
  await caricaSolo();
}

// ════════════════════════════════════════════════════════
//  CATEGORIE SOLO — mini-modale (CRUD su solo_categorie)
// ════════════════════════════════════════════════════════
function apriSoloCat(){
  _soloCatEditId = null;
  renderSoloCatModal();
  document.getElementById("modal-solo-cat").classList.add("attivo");
}
function chiudiSoloCat(){ document.getElementById("modal-solo-cat").classList.remove("attivo"); }

function renderSoloCatModal(){
  var lista = document.getElementById("solocat-lista");
  var cats  = soloCategorie || [];
  if(!cats.length){
    lista.innerHTML = '<div class="cat-empty">Nessuna categoria.</div>'
      + '<button class="mb-azione-btn" onclick="aggiungiSetComuniSolo()">✨ Aggiungi set comuni</button>';
  } else {
    lista.innerHTML = cats.map(function(c){
      return '<div class="cat-row">'
        + '<span class="cat-ico">' + escapeHtml(c.icona || "📌") + '</span>'
        + '<span class="cat-nome">' + escapeHtml(c.nome) + '</span>'
        + '<button class="mb-btn" onclick="modificaSoloCat(\'' + c.id + '\')" title="Modifica">✏️</button>'
        + '<button class="mb-btn" onclick="eliminaSoloCat(\'' + c.id + '\')" title="Elimina">🗑️</button>'
        + '</div>';
    }).join("");
  }
  soloCatFormReset();
}
function soloCatFormReset(){
  _soloCatEditId = null;
  document.getElementById("solocat-icona").value = "";
  document.getElementById("solocat-nome").value  = "";
  document.getElementById("solocat-add-btn").textContent = "Aggiungi";
  soloCatErrore("");
}
function soloCatErrore(m){ document.getElementById("solocat-error").textContent = m || ""; }

async function aggiungiVoceCat(){
  var icona = document.getElementById("solocat-icona").value.trim();
  var nome  = document.getElementById("solocat-nome").value.trim();
  if(!nome){ soloCatErrore("Scrivi un nome."); return; }
  var r;
  if(_soloCatEditId){
    r = await sb.from("solo_categorie").update({ nome: nome, icona: icona || "📌" }).eq("id", _soloCatEditId);
  } else {
    var ordine = (soloCategorie || []).length;   // user_id dal default
    r = await sb.from("solo_categorie").insert({ nome: nome, icona: icona || "📌", ordine: ordine });
  }
  if(r.error){ soloCatErrore("Errore: " + r.error.message); return; }
  await caricaSolo();
  renderSoloCatModal();
  popolaVoceCategoria();
}
function modificaSoloCat(id){
  var c = (soloCategorie || []).find(function(x){ return String(x.id) === String(id); });
  if(!c) return;
  _soloCatEditId = id;
  document.getElementById("solocat-icona").value = c.icona || "";
  document.getElementById("solocat-nome").value  = c.nome || "";
  document.getElementById("solocat-add-btn").textContent = "Salva";
  soloCatErrore("");
  document.getElementById("solocat-nome").focus();
}
async function eliminaSoloCat(id){
  if(!confirm("Eliminare questa categoria?\nLe voci passate restano (mostreranno 📌).")) return;
  var r = await sb.from("solo_categorie").delete().eq("id", id);
  if(r.error){ soloCatErrore("Errore: " + r.error.message); return; }
  await caricaSolo();
  renderSoloCatModal();
  popolaVoceCategoria();
}
async function aggiungiSetComuniSolo(){
  var set = [
    { icona: "🍽️", nome: "Cibo" },      { icona: "🛒", nome: "Spesa" },
    { icona: "🏠", nome: "Casa" },       { icona: "💡", nome: "Bollette" },
    { icona: "🚗", nome: "Trasporti" },  { icona: "🎬", nome: "Svago" },
    { icona: "💊", nome: "Salute" },     { icona: "🎁", nome: "Regali" },
    { icona: "💼", nome: "Stipendio" },  { icona: "💸", nome: "Extra" }
  ];
  var base = (soloCategorie || []).length;
  var rows = set.map(function(c, i){ return { nome: c.nome, icona: c.icona, ordine: base + i }; });
  var r = await sb.from("solo_categorie").insert(rows);
  if(r.error){ soloCatErrore("Errore: " + r.error.message); return; }
  await caricaSolo();
  renderSoloCatModal();
  popolaVoceCategoria();
}

// ════════════════════════════════════════════════════════
//  REALTIME — sincronizza più dispositivi dello stesso account.
//  La RLS limita gli eventi alle proprie righe.
// ════════════════════════════════════════════════════════
var _rtSolo = null, _rtSoloTimer = null;
function initRealtimeSolo(){
  chiudiRealtimeSolo();
  _rtSolo = sb.channel("solo")
    .on("postgres_changes", { event: "*", schema: "public", table: "solo_voci" },      debounceSolo)
    .on("postgres_changes", { event: "*", schema: "public", table: "solo_categorie" }, debounceSolo)
    .subscribe();
}
function debounceSolo(){
  clearTimeout(_rtSoloTimer);
  _rtSoloTimer = setTimeout(function(){
    var el = document.getElementById("solo-screen");
    if(el && el.classList.contains("attiva")) caricaSolo();
  }, 700);
}
function chiudiRealtimeSolo(){
  if(_rtSolo){ sb.removeChannel(_rtSolo); _rtSolo = null; }
}
