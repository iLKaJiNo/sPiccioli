// ════════════════════════════════════════════════════════
//  sPiccioli! — ricorrenti.js
//  S7d UI: fisse & previste. Due scope (cassa coppia | solo),
//  overlay lista + form ricco + banner promemoria manuali.
// ════════════════════════════════════════════════════════
var ricorrentiCassa = [];
var ricorrentiSolo  = [];
var _ricScope  = "solo";
var _ricEditId = null;
var _ricAuto   = true;      // ⚡ automatica
var _ricRipeti = true;      // 🔁 ricorrente
var _ricTipo   = "uscita";  // solo
var _ricLimite = "nessuno"; // nessuno|data|volte

function _listaScope(s){ return s === "cassa" ? ricorrentiCassa : ricorrentiSolo; }
function _ricLista(){ return _listaScope(_ricScope); }
function _ricCats(){ return _ricScope === "cassa" ? (categorieCassa||[]) : (soloCategorie||[]); }
function _ricIcona(nome){ var c=_ricCats().find(function(x){return x.nome===nome;}); return (c&&c.icona)||"📌"; }

// ── LOAD (chiamate da caricaCassa / caricaSolo) ──
async function caricaRicorrentiCassa(){
  if(!cassaCorrente || cassaCorrente.tipo !== "coppia"){ ricorrentiCassa = []; aggiornaBannerRicorrenti("cassa"); return; }
  var r = await sb.from("ricorrenti").select("*").eq("scope","cassa").eq("cassa_id", cassaCorrente.id).order("prossima_scadenza");
  ricorrentiCassa = r.data || [];
  aggiornaBannerRicorrenti("cassa");
}
async function caricaRicorrentiSolo(){
  var r = await sb.from("ricorrenti").select("*").eq("scope","solo").order("prossima_scadenza");
  ricorrentiSolo = r.data || [];
  aggiornaBannerRicorrenti("solo");
}

// ── BANNER manuali in attesa ──
function aggiornaBannerRicorrenti(scope){
  var box = document.getElementById(scope === "cassa" ? "ric-banner-cassa" : "ric-banner-solo");
  if(!box) return;
  var oggi = new Date().toISOString().slice(0,10);
  var pend = _listaScope(scope).filter(function(r){ return r.attiva && !r.automatica && r.prossima_scadenza <= oggi; });
  box.innerHTML = pend.length
    ? '<div class="ric-banner" onclick="apriRicorrenti(\''+scope+'\')">🔔 ' + pend.length
        + (pend.length===1?' spesa da confermare':' spese da confermare')
        + '<span class="ric-banner-go">Apri ›</span></div>'
    : "";
}

// ── OVERLAY LISTA ──
function apriRicorrenti(scope){ _ricScope = scope; renderRicorrentiLista(); document.getElementById("ricorrenti-overlay").classList.add("attivo"); }
function chiudiRicorrenti(){ document.getElementById("ricorrenti-overlay").classList.remove("attivo"); }

function renderRicorrentiLista(){
  var wrap = document.getElementById("ricorrenti-body");
  if(!wrap) return;
  var oggi = new Date().toISOString().slice(0,10);
  var lista = (_ricLista()||[]).filter(function(r){ return r.attiva; });
  var html = '<button class="btn-chiudi-mese" style="margin-bottom:14px;" onclick="apriFormRicorrente()">➕ Nuova</button>';
  if(!lista.length){
    html += '<div class="mv-empty" style="padding:16px 6px;">Nessuna fissa o prevista.</div>';
  } else {
    html += lista.map(function(r){
      var ico = _ricIcona(r.categoria);
      var tipoTxt = !r.ricorrente ? "una-tantum" : ("ogni " + (r.ogni_quanto>1 ? r.ogni_quanto+" " : "") + r.unita);
      var auto = r.automatica ? "⚡" : "✋";
      var due  = (!r.automatica && r.prossima_scadenza <= oggi);
      var conf = due ? '<button class="btn-salda" onclick="event.stopPropagation();confermaManuale(\''+r.id+'\')">✓ Registra</button>' : '';
      return '<div class="arch-row" onclick="apriFormRicorrente(\''+r.id+'\')" tabindex="0" role="button">'
        + '<div class="arch-main"><div class="arch-titolo">'+ico+' '+escapeHtml(r.nome)+' '+auto+'</div>'
        + '<div class="arch-meta">'+importoCon(parseFloat(r.importo)||0,"EUR")+' · '+tipoTxt+' · prossima '+fmt(r.prossima_scadenza)+'</div></div>'
        + conf + '<div class="cassa-freccia">›</div></div>';
    }).join("");
  }
  wrap.innerHTML = html;
}

async function confermaManuale(id){
  if(!navigator.onLine){ await alertBrand("Serve una connessione."); return; }
  var fn = _ricScope === "cassa" ? "conferma_ricorrente_cassa" : "conferma_ricorrente_solo";
  var r = await sb.rpc(fn, { p_id: id });
  if(r.error){ await alertBrand(msgErrore(r.error)); return; }
  if(_ricScope === "cassa") await caricaCassa(); else await caricaSolo();
  renderRicorrentiLista();
}

// ── FORM nuova/modifica ──
function apriFormRicorrente(id){
  _ricEditId = id || null;
  var r = id ? (_ricLista()||[]).find(function(x){ return String(x.id)===String(id); }) : null;
  document.getElementById("ric-pagante-row").style.display = (_ricScope==="cassa") ? "block" : "none";
  document.getElementById("ric-tipo-row").style.display    = (_ricScope==="solo")  ? "block" : "none";

  var sel = document.getElementById("ric-categoria");
  sel.innerHTML = '<option value="">— nessuna —</option>' + _ricCats().map(function(c){
    return '<option value="'+escapeHtml(c.nome)+'">'+escapeHtml((c.icona||"📌")+" "+c.nome)+'</option>';
  }).join("");

  if(_ricScope==="cassa"){
    var nomi = nomiMembri();
    document.getElementById("ric-pagante").innerHTML = membriCorrente.map(function(m){
      return '<option value="'+m.id+'">'+escapeHtml(nomi[m.id]||"?")+'</option>';
    }).join("");
  }

  document.getElementById("ric-nome").value = r ? (r.nome||"") : "";
  document.getElementById("ric-importo").value = r ? r.importo : "";
  document.getElementById("ric-scadenza").value = r ? r.prossima_scadenza : new Date().toISOString().slice(0,10);
  if(r && r.categoria) sel.value = r.categoria;
  document.getElementById("ric-ogni").value = r ? (r.ogni_quanto||1) : 1;
  document.getElementById("ric-unita").value = r ? (r.unita||"mesi") : "mesi";

  _ricAuto   = r ? !!r.automatica : true;
  _ricRipeti = r ? !!r.ricorrente : true;
  _ricTipo   = r ? (r.tipo||"uscita") : "uscita";
  document.getElementById("ric-fine-data").value = "";
  document.getElementById("ric-volte").value = "";
  if(r && r.fine_data){ _ricLimite="data"; document.getElementById("ric-fine-data").value = r.fine_data; }
  else if(r && r.volte_rimaste!=null){ _ricLimite="volte"; document.getElementById("ric-volte").value = r.volte_rimaste; }
  else { _ricLimite="nessuno"; }

  _ricSegSync();
  ricFormErrore("");
  document.getElementById("modal-ricorrente-titolo").textContent = id ? "Modifica" : "Nuova fissa / prevista";
  document.getElementById("ric-elimina-btn").style.display = id ? "block" : "none";
  document.getElementById("modal-ricorrente").classList.add("attivo");
}
function chiudiFormRicorrente(){ document.getElementById("modal-ricorrente").classList.remove("attivo"); }
function ricFormErrore(m){ document.getElementById("ric-form-error").textContent = m || ""; }

function setRicAuto(v){ _ricAuto = v; _ricSegSync(); }
function setRicRipeti(v){ _ricRipeti = v; _ricSegSync(); }
function setRicTipo(v){ _ricTipo = v; _ricSegSync(); }
function setRicLimite(v){ _ricLimite = v; _ricSegSync(); }

function _ricSegSync(){
  document.querySelectorAll("#ric-auto-seg .split-btn").forEach(function(b){ b.classList.toggle("attivo", (b.getAttribute("data-v")==="auto")===_ricAuto); });
  document.querySelectorAll("#ric-ripeti-seg .split-btn").forEach(function(b){ b.classList.toggle("attivo", (b.getAttribute("data-v")==="si")===_ricRipeti); });
  document.querySelectorAll("#ric-tipo-seg .split-btn").forEach(function(b){ b.classList.toggle("attivo", b.getAttribute("data-v")===_ricTipo); });
  document.querySelectorAll("#ric-limite-seg .split-btn").forEach(function(b){ b.classList.toggle("attivo", b.getAttribute("data-v")===_ricLimite); });
  document.getElementById("ric-ricorrenza").style.display  = _ricRipeti ? "block" : "none";
  document.getElementById("ric-limite-wrap").style.display = _ricRipeti ? "block" : "none";
  document.getElementById("ric-fine-wrap").style.display   = (_ricRipeti && _ricLimite==="data")  ? "block" : "none";
  document.getElementById("ric-volte-wrap").style.display  = (_ricRipeti && _ricLimite==="volte") ? "block" : "none";
}

async function salvaRicorrente(){
  var nome = document.getElementById("ric-nome").value.trim();
  var imp  = parseFloat(document.getElementById("ric-importo").value);
  var cat  = document.getElementById("ric-categoria").value || null;
  var scad = document.getElementById("ric-scadenza").value;
  if(!nome){ ricFormErrore("Dai un nome."); return; }
  if(!imp || imp <= 0){ ricFormErrore("Importo non valido."); return; }
  if(!scad){ ricFormErrore("Scegli la prima scadenza."); return; }
  var ogni = parseInt(document.getElementById("ric-ogni").value,10) || 1;
  var unita = document.getElementById("ric-unita").value || "mesi";
  var fine = null, volte = null;
  if(_ricRipeti){
    if(ogni < 1){ ricFormErrore("Ogni quanto: minimo 1."); return; }
    if(_ricLimite==="data"){ fine = document.getElementById("ric-fine-data").value || null; }
    if(_ricLimite==="volte"){ volte = parseInt(document.getElementById("ric-volte").value,10); if(!volte||volte<1){ ricFormErrore("Numero di volte non valido."); return; } }
  }
  var row = {
    nome:nome, importo:imp, categoria:cat, prossima_scadenza:scad,
    ricorrente:_ricRipeti, ogni_quanto:ogni, unita:unita,
    fine_data:fine, volte_rimaste:volte, automatica:_ricAuto, attiva:true
  };
  if(_ricScope === "cassa"){
    row.scope="cassa"; row.cassa_id=cassaCorrente.id;
    row.pagante_id=document.getElementById("ric-pagante").value; row.metodo_split="equo";
  } else { row.scope="solo"; row.tipo=_ricTipo; }

  var r = _ricEditId
    ? await sb.from("ricorrenti").update(row).eq("id", _ricEditId)
    : await sb.from("ricorrenti").insert(row);
  if(r.error){ ricFormErrore(msgErrore(r.error)); return; }
  chiudiFormRicorrente();
  if(_ricAuto && navigator.onLine){
    try{
      if(_ricScope==="cassa") await sb.rpc("materializza_ricorrenti_cassa", { p_cassa_id: cassaCorrente.id });
      else await sb.rpc("materializza_ricorrenti_solo");
    }catch(e){}
  }
  if(_ricScope === "cassa") await caricaCassa(); else await caricaSolo();
  renderRicorrentiLista();
}

async function eliminaRicorrente(){
  if(!_ricEditId) return;
  var ok = await confermaBrand({
    titolo: "Eliminare questa fissa/prevista?",
    testo: "Le voci già registrate restano.",
    cta: "🗑️ Elimina", danger: true
  });
  if(!ok) return;
  var r = await sb.from("ricorrenti").delete().eq("id", _ricEditId);
  if(r.error){ ricFormErrore(msgErrore(r.error)); return; }
  chiudiFormRicorrente();
  if(_ricScope === "cassa") await caricaRicorrentiCassa(); else await caricaRicorrentiSolo();
  renderRicorrentiLista();
}
