// ════════════════════════════════════════════════════════
//  sPiccioli! — lista.js
//  Tab "Lista": bacheca note (multipost) + lista della spesa.
//  Stato: S.note, S.lista (caricati da api.js). Azioni via post().
//  Dipende da: utils.js (escapeHtml, fmt, profiloUtente), cassa.js (nomeDi),
//  api.js (post, dotC). membriTutti/cassaCorrente globali.
// ════════════════════════════════════════════════════════

var _notaEdit = null;            // id nota in modifica inline (o null)
var _svuotaListaConfirm = false;

function nomeAutore(uid){
  if(!uid) return "?";
  var m = (membriTutti || []).find(function(x){ return x.user_id === uid; });
  return m ? nomeDi(m) : "?";
}
function _mioUid(){ return profiloUtente && profiloUtente.id; }
function _sonoAdmin(){ return !!(cassaCorrente && cassaCorrente.ruolo === "admin"); }
function _notaAuto(t){ if(!t) return; t.style.height="auto"; t.style.height=Math.min(t.scrollHeight,200)+"px"; }

// ── RENDER ──────────────────────────────────────────────
function renderLista(){
  var el = document.getElementById("lista-content");
  if(!el) return;
  if(!S.note) S.note = [];
  if(!S.lista) S.lista = [];
  var bloc = cassaBloccata();

  var compEl = document.getElementById("nota-nuova");
  var compVal = compEl ? compEl.value : "";
  var compFocused = compEl && document.activeElement === compEl;

  var h = "";
  // 1. BACHECA NOTE
  h += '<div class="card bacheca-card">';
  h += '<div class="card-titolo">📝 Bacheca</div>';
  if(!bloc){
    h += '<div class="nota-composer">';
    h += '<textarea id="nota-nuova" class="nota-textarea" placeholder="Scrivi una nota per la cassa…" oninput="_notaAuto(this)"></textarea>';
    h += '<button class="btn-accent btn-nota-add" onclick="addNota()">Aggiungi nota</button>';
    h += '</div>';
  }
  if(!S.note.length){
    h += '<div class="vuoto-hint">Ancora nessuna nota.</div>';
  } else {
    S.note.forEach(function(n){
      var puoi = (n.autore === _mioUid()) || _sonoAdmin();
      var mod = n.aggiornata_il && n.creata_il && (new Date(n.aggiornata_il) - new Date(n.creata_il) > 1000);
      if(_notaEdit === n.id && !bloc){
        h += '<div class="nota-item in-edit">';
        h += '<textarea id="nota-edit-'+n.id+'" class="nota-textarea">'+escapeHtml(n.testo)+'</textarea>';
        h += '<div class="nota-edit-actions">';
        h += '<button class="btn-mini btn-accent" onclick="salvaNotaEdit(\''+n.id+'\')">Salva</button>';
        h += '<button class="btn-mini btn-ghost" onclick="_notaEdit=null;renderLista()">Annulla</button>';
        h += '</div></div>';
      } else {
        h += '<div class="nota-item">';
        h += '<div class="nota-testo">'+escapeHtml(n.testo)+'</div>';
        h += '<div class="nota-foot">';
        h += '<span class="nota-meta">'+escapeHtml(nomeAutore(n.autore))+' · '+fmt(n.creata_il)+(mod?' · modificata':'')+'</span>';
        if(puoi && !bloc){
          h += '<span class="nota-azioni">';
          h += '<button class="nota-ico" title="Modifica" onclick="startNotaEdit(\''+n.id+'\')">✏️</button>';
          h += '<button class="nota-ico" title="Elimina" onclick="deleteNota(\''+n.id+'\')">🗑️</button>';
          h += '</span>';
        }
        h += '</div></div>';
      }
    });
  }
  h += '</div>';

  // 2. LISTA DELLA SPESA
  h += '<div class="card lista-card">';
  h += '<div class="card-titolo">🧺 Lista della spesa</div>';
  if(!bloc){
    h += '<div class="lista-input-row">';
    h += '<input class="lista-inp-testo" type="text" id="lista-testo" placeholder="Latte, Pasta, Miele…" autocomplete="off" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addListaItem();}">';
    h += '<input class="lista-inp-qty" type="text" id="lista-qty" placeholder="Qtà" autocomplete="off" onkeydown="if(event.key===\'Enter\'){event.preventDefault();addListaItem();}">';
    h += '<button class="btn-accent btn-add-lista" onclick="addListaItem()" aria-label="Aggiungi">+</button>';
    h += '</div>';
  }
  var attivi = S.lista.filter(function(i){ return !i.completata; });
  var fatti  = S.lista.filter(function(i){ return i.completata; });
  if(!S.lista.length){
    h += '<div class="vuoto-hint">Lista vuota'+(bloc?'.':' — aggiungi qualcosa!')+'</div>';
  } else {
    if(!bloc){
      h += '<div class="lista-check-all-row">';
      if(attivi.length) h += '<button class="btn-ghost btn-mini" onclick="checkAllLista(true)">✅ Spunta tutti ('+attivi.length+')</button>';
      if(fatti.length)  h += '<button class="btn-ghost btn-mini" onclick="checkAllLista(false)">⬜ Deseleziona ('+fatti.length+')</button>';
      h += '</div>';
    }
    attivi.forEach(function(it){ h += renderListaItem(it); });
    if(fatti.length){
      h += '<div class="lista-sep">✅ Nel carrello ('+fatti.length+')</div>';
      if(fatti.length <= 4){
        fatti.forEach(function(it){ h += renderListaItem(it); });
      } else {
        var _cn = fatti.length - 3;
        var _ckey = "spiccioli_carrello_aperto_" + cassaCorrente.id;
        var _cap = accordionAperto(_ckey, false);
        fatti.slice(0,3).forEach(function(it){ h += renderListaItem(it); });
        h += '<button id="car-acc-btn" onclick="accordionToggle(\'car-acc-box\',\'car-acc-btn\',\''+_ckey+'\')" style="'+ACCORDION_BTN_STYLE+'">'
           + (_cap ? "▾ Nascondi" : ("▸ Mostra gli altri "+_cn)) + '</button>';
        h += '<div id="car-acc-box" data-open="'+(_cap?"1":"0")+'" data-count="'+_cn+'" style="overflow:hidden;transition:max-height .35s ease;max-height:'+(_cap?"none":"0px")+';">';
        fatti.slice(3).forEach(function(it){ h += renderListaItem(it); });
        h += '</div>';
      }
    }
    if(!bloc){
      h += '<div class="lista-actions">';
      if(fatti.length) h += '<button class="btn-ghost btn-mini" onclick="clearListaCompletati()">🗑️ Elimina spuntati ('+fatti.length+')</button>';
      h += '<button class="btn-ghost btn-mini" onclick="svuotaListaConfirm()">🗑️ Svuota tutto</button>';
      h += '</div>';
      if(_svuotaListaConfirm){
        h += '<div class="svuota-confirm"><span>Eliminare tutta la lista?</span>';
        h += '<button class="btn-mini btn-accent" onclick="svuotaLista()">Sì</button>';
        h += '<button class="btn-mini btn-ghost" onclick="_svuotaListaConfirm=false;renderLista()">No</button>';
        h += '</div>';
      }
    }
  }
  h += '</div>';

  el.innerHTML = h;
  var c2 = document.getElementById("nota-nuova");
  if(c2 && compVal){ c2.value = compVal; _notaAuto(c2); }
  if(compFocused && c2){ c2.focus(); }
}

function renderListaItem(item){
  var bloc = cassaBloccata();
  var h = '<div class="lista-item'+(item.completata?" completata":"")+'">';
  h += bloc
     ? '<span class="lista-check">'+(item.completata?'✅':'⬜')+'</span>'
     : '<button class="lista-check" onclick="toggleListaItem(\''+item.id+'\')">'+(item.completata?'✅':'⬜')+'</button>';
  h += '<div class="lista-item-body">';
  if(item.quantita) h += '<span class="lista-qty">'+escapeHtml(item.quantita)+'</span>';
  h += '<span class="lista-testo">'+escapeHtml(item.testo)+'</span>';
  h += '</div>';
  if(!bloc) h += '<button class="lista-del" onclick="deleteListaItem(\''+item.id+'\')" aria-label="Elimina">✕</button>';
  h += '</div>';
  return h;
}

// ── NOTE — CRUD (optimistic + rollback) ──
async function addNota(){
  if(cassaBloccata()) return;
  var t = document.getElementById("nota-nuova");
  var testo = t ? t.value.trim() : "";
  if(!testo){ if(t) t.focus(); return; }
  var n = { id: crypto.randomUUID(), cassa_id: cassaCorrente.id, testo: testo,
            autore: _mioUid(), creata_il: new Date().toISOString(), aggiornata_il: new Date().toISOString() };
  S.note.unshift(n);
  if(t) t.value = "";
  renderLista(); dotC("", "Salvataggio…");
  try{ var esito = await post({ action:"addNota", id:n.id, cassa_id:n.cassa_id, testo:n.testo, autore:n.autore }); dotC(esito==="queued" ? "err" : "ok", esito==="queued" ? "In attesa" : "Sincronizzata"); }
  catch(e){ S.note = S.note.filter(function(x){ return x.id !== n.id; }); renderLista(); dotC("err","Errore"); }
}
function startNotaEdit(id){
  _notaEdit = id; renderLista();
  setTimeout(function(){ var e=document.getElementById("nota-edit-"+id); if(e){ e.focus(); _notaAuto(e); } }, 40);
}
async function salvaNotaEdit(id){
  var e = document.getElementById("nota-edit-"+id);
  var nuovo = e ? e.value.trim() : "";
  var n = S.note.find(function(x){ return x.id === id; });
  if(!n){ _notaEdit=null; renderLista(); return; }
  if(!nuovo){ deleteNota(id); return; }
  var vT = n.testo, vA = n.aggiornata_il;
  n.testo = nuovo; n.aggiornata_il = new Date().toISOString();
  _notaEdit = null; renderLista(); dotC("", "Salvataggio…");
  try{ var esito = await post({ action:"editNota", id:id, testo:nuovo }); dotC(esito==="queued" ? "err" : "ok", esito==="queued" ? "In attesa" : "Sincronizzata"); }
  catch(e2){ n.testo = vT; n.aggiornata_il = vA; renderLista(); dotC("err","Errore"); }
}
async function deleteNota(id){
  var idx = S.note.findIndex(function(x){ return x.id === id; });
  if(idx < 0) return;
  var bak = S.note[idx];
  S.note.splice(idx,1); if(_notaEdit===id) _notaEdit=null;
  renderLista(); dotC("", "Salvataggio…");
  try{ var esito = await post({ action:"deleteNota", id:id }); dotC(esito==="queued" ? "err" : "ok", esito==="queued" ? "In attesa" : "Sincronizzata"); }
  catch(e){ S.note.splice(idx,0,bak); renderLista(); dotC("err","Errore"); }
}

// ── LISTA SPESA — CRUD (optimistic + rollback) ──
async function addListaItem(){
  if(cassaBloccata()) return;
  var testoEl = document.getElementById("lista-testo");
  var qtyEl   = document.getElementById("lista-qty");
  var testo = testoEl ? testoEl.value.trim() : "";
  if(!testo){ if(testoEl) testoEl.focus(); return; }
  var qty = qtyEl ? qtyEl.value.trim() : "";
  var item = { id: crypto.randomUUID(), cassa_id: cassaCorrente.id, testo: testo,
               quantita: qty, completata: false, autore: _mioUid(), creata_il: new Date().toISOString() };
  S.lista.push(item);
  if(testoEl) testoEl.value=""; if(qtyEl) qtyEl.value="";
  renderLista();
  setTimeout(function(){ var e=document.getElementById("lista-testo"); if(e) e.focus(); }, 40);
  dotC("", "Salvataggio…");
  try{ var esito = await post({ action:"addListaItem", id:item.id, cassa_id:item.cassa_id, testo:item.testo, quantita:item.quantita, autore:item.autore }); dotC(esito==="queued" ? "err" : "ok", esito==="queued" ? "In attesa" : "Sincronizzata"); }
  catch(e){ S.lista = S.lista.filter(function(x){ return x.id !== item.id; }); renderLista(); dotC("err","Errore"); }
}
async function toggleListaItem(id){
  var it = S.lista.find(function(x){ return x.id === id; });
  if(!it) return;
  it.completata = !it.completata;
  renderLista(); dotC("", "Salvataggio…");
  try{ var esito = await post({ action:"toggleListaItem", id:id, completata:it.completata }); dotC(esito==="queued" ? "err" : "ok", esito==="queued" ? "In attesa" : "Sincronizzata"); }
  catch(e){ it.completata = !it.completata; renderLista(); dotC("err","Errore"); }
}
async function checkAllLista(v){
  var bak = S.lista.map(function(x){ return { id:x.id, completata:x.completata }; });
  S.lista.forEach(function(it){ it.completata = v; });
  renderLista(); dotC("", "Salvataggio…");
  try{ var esito = await post({ action:"checkAllLista", cassa_id:cassaCorrente.id, completata:v }); dotC(esito==="queued" ? "err" : "ok", esito==="queued" ? "In attesa" : "Sincronizzata"); }
  catch(e){ bak.forEach(function(b){ var it=S.lista.find(function(x){return x.id===b.id;}); if(it) it.completata=b.completata; }); renderLista(); dotC("err","Errore"); }
}
async function deleteListaItem(id){
  var bak = S.lista.slice();
  S.lista = S.lista.filter(function(x){ return x.id !== id; });
  renderLista(); dotC("", "Salvataggio…");
  try{ var esito = await post({ action:"deleteListaItem", id:id }); dotC(esito==="queued" ? "err" : "ok", esito==="queued" ? "In attesa" : "Sincronizzata"); }
  catch(e){ S.lista = bak; renderLista(); dotC("err","Errore"); }
}
async function clearListaCompletati(){
  var bak = S.lista.slice();
  S.lista = S.lista.filter(function(x){ return !x.completata; });
  renderLista(); dotC("", "Salvataggio…");
  try{ var esito = await post({ action:"clearListaItems", cassa_id:cassaCorrente.id, soloCompletate:true }); dotC(esito==="queued" ? "err" : "ok", esito==="queued" ? "In attesa" : "Sincronizzata"); }
  catch(e){ S.lista = bak; renderLista(); dotC("err","Errore"); }
}
function svuotaListaConfirm(){ _svuotaListaConfirm = true; renderLista(); }
async function svuotaLista(){
  var bak = S.lista.slice();
  S.lista = []; _svuotaListaConfirm = false;
  renderLista(); dotC("", "Salvataggio…");
  try{ var esito = await post({ action:"clearListaItems", cassa_id:cassaCorrente.id, soloCompletate:false }); dotC(esito==="queued" ? "err" : "ok", esito==="queued" ? "In attesa" : "Sincronizzata"); }
  catch(e){ S.lista = bak; renderLista(); dotC("err","Errore"); }
}
