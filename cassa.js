// ════════════════════════════════════════════════════════
//  sPiccioli! — cassa.js
//  UI dentro una cassa: saldi, movimenti, nuova spesa, settle-up.
//  S5a: divisione equo / esatto / percentuale / quote (pesi salvati).
//  + dettaglio movimento al tap, nomi membro robusti.
// ════════════════════════════════════════════════════════

// ── INTESTAZIONE ──
function intestaCassa(){
  document.getElementById("cassa-emoji").textContent  = emojiTema(cassaCorrente.tema);
  document.getElementById("cassa-titolo").textContent = cassaCorrente.nome;
}
function skeletonsCassa(){
  document.getElementById("saldi-list").innerHTML = '<div class="sk"></div><div class="sk"></div>';
  document.getElementById("movimenti-list").innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div>';
}
function invitaCassa(){
  alert("Condividi questo codice per far entrare qualcuno:\n\n" + cassaCorrente.codice_invito);
}

// Nome di un membro, con fallback: nome del membro → nome del profilo → "Senza nome".
function nomeDi(m){
  if(!m) return "?";
  if(m.nome && m.nome.trim()) return m.nome.trim();
  if(m.profili && m.profili.nome && m.profili.nome.trim()) return m.profili.nome.trim();
  return "Senza nome";
}
function nomiMembri(){
  var n = {};
  membriCorrente.forEach(function(m){ n[m.id] = nomeDi(m); });
  return n;
}

// ── RENDER PRINCIPALE ──
function renderCassa(){
  renderSaldi();
  renderPaganteSelect();
  renderMovimenti();
}

// ── SALDI ──
function renderSaldi(){
  var saldi  = calcolaSaldi();
  var titolo = document.getElementById("saldi-titolo");
  var wrap   = document.getElementById("saldi-list");
  var extra  = document.getElementById("settle-extra");
  extra.innerHTML = "";

  var tuttiPari = membriCorrente.every(function(m){ return Math.abs(saldi[m.id] || 0) < 0.005; });

  if(cassaCorrente.modalita === "diretti"){
    titolo.textContent = "Chi deve a chi";
    if(tuttiPari){ wrap.innerHTML = '<div class="saldi-pari">Tutti in pari! 🎉</div>'; return; }
    wrap.innerHTML = simplificaDebiti(saldi).map(rigaDebito).join("");
    return;
  }

  titolo.textContent = "I conti";
  if(tuttiPari){ wrap.innerHTML = '<div class="saldi-pari">Tutti in pari! 🎉</div>'; return; }

  var nomi = nomiMembri();
  wrap.innerHTML = membriCorrente.map(function(m){
    var s   = saldi[m.id] || 0;
    var cls = s > 0.005 ? "credito" : (s < -0.005 ? "debito" : "pari");
    var lbl = s > 0.005 ? "in credito" : (s < -0.005 ? "in debito" : "in pari");
    var seg = s > 0.005 ? "+" : (s < -0.005 ? "−" : "");
    return '<div class="saldo-membro">'
      +   '<span class="sm-nome">' + escapeHtml(nomi[m.id]) + '</span>'
      +   '<span class="sm-val ' + cls + '">' + seg + eur(Math.abs(s)) + '<small>' + lbl + '</small></span>'
      + '</div>';
  }).join("");

  var debiti = simplificaDebiti(saldi);
  if(debiti.length){
    extra.innerHTML = '<div class="card"><div class="card-titolo">Salda i conti</div>'
      + debiti.map(rigaDebito).join("") + '</div>';
  }
}

function rigaDebito(d){
  var nomi = nomiMembri();
  return '<div class="riga-debito">'
    +   '<div class="rd-txt"><b>' + escapeHtml(nomi[d.da] || "?") + '</b> deve '
    +     '<b>' + eur(d.importo) + '</b> a <b>' + escapeHtml(nomi[d.a] || "?") + '</b></div>'
    +   '<button class="btn-salda" onclick="apriSettle(\'' + d.da + '\',\'' + d.a + '\',' + d.importo + ')">Salda</button>'
    + '</div>';
}

// ── SELECT "pagato da" ──
function renderPaganteSelect(){
  var sel = document.getElementById("mv-pagante");
  var mio = mioMembro();
  sel.innerHTML = membriCorrente.map(function(m){
    var s = (mio && m.id === mio.id) ? " selected" : "";
    return '<option value="' + m.id + '"' + s + '>' + escapeHtml(nomeDi(m)) + '</option>';
  }).join("");
}

// ── LISTA MOVIMENTI (tap per il dettaglio) ──
function renderMovimenti(){
  var wrap = document.getElementById("movimenti-list");
  var movs = S.movimenti || [];
  if(!movs.length){
    wrap.innerHTML = '<div class="mv-empty">Ancora nessuna spesa.<br>Aggiungi la prima! 👆</div>';
    return;
  }
  var nomi = nomiMembri();

  wrap.innerHTML = movs.map(function(mov){
    var temp = String(mov.id).indexOf("temp-") === 0;
    var del  = '<button class="mv-del" onclick="event.stopPropagation();eliminaMovimento(\'' + mov.id + '\')" title="Elimina">×</button>';
    var apri = temp ? "" : ' onclick="apriDettaglio(\'' + mov.id + '\')"';

    if(mov.tipo === "settle"){
      var da = nomi[(mov.paganti[0] || {}).membro_id] || "?";
      var a  = nomi[(mov.quote[0]   || {}).membro_id] || "?";
      return '<div class="mv-item mv-settle' + (temp ? " mv-temp" : "") + '"' + apri + '>'
        +   '<div class="mv-main"><div class="mv-desc">💸 Rimborso</div>'
        +     '<div class="mv-meta">' + fmt(mov.data) + ' · ' + escapeHtml(da) + ' → ' + escapeHtml(a) + '</div></div>'
        +   '<div class="mv-imp">' + eur(mov.importo) + '</div>' + del
        + '</div>';
    }

    var pag = (mov.paganti || []).map(function(p){ return escapeHtml(nomi[p.membro_id] || "?"); }).join(", ");
    var badge = (mov.metodo_split && mov.metodo_split !== "equo")
      ? '<span class="mv-badge">' + etichettaMetodo(mov.metodo_split) + '</span>' : '';
    return '<div class="mv-item' + (temp ? " mv-temp" : "") + '"' + apri + '>'
      +   '<div class="mv-main">'
      +     '<div class="mv-desc">' + escapeHtml(mov.descrizione || "(senza descrizione)") + badge + '</div>'
      +     '<div class="mv-meta">' + fmt(mov.data) + ' · pagato da ' + (pag || "—") + '</div>'
      +   '</div>'
      +   '<div class="mv-imp">' + eur(mov.importo) + '</div>' + del
      + '</div>';
  }).join("");
}
function etichettaMetodo(m){
  return { esatto:"importi", percentuale:"%", quote:"quote" }[m] || m;
}

// ── DETTAGLIO MOVIMENTO ──
function apriDettaglio(id){
  if(String(id).indexOf("temp-") === 0) return;
  var mov = (S.movimenti || []).find(function(m){ return String(m.id) === String(id); });
  if(!mov) return;
  var nomi = nomiMembri();

  var titolo = mov.tipo === "settle" ? "💸 Rimborso" : (mov.descrizione || "(senza descrizione)");
  var html = '<div class="det-top">'
    +   '<div class="det-titolo">' + escapeHtml(titolo) + '</div>'
    +   '<div class="det-imp">' + eur(mov.importo) + '</div>'
    +   '<div class="det-data">' + fmtLong(mov.data) + '</div>'
    + '</div>';

  html += '<div class="det-sez"><div class="det-sez-h">Pagato da</div>';
  (mov.paganti || []).forEach(function(p){
    html += '<div class="det-riga"><span>' + escapeHtml(nomi[p.membro_id] || "?") + '</span><span>' + eur(p.importo) + '</span></div>';
  });
  html += '</div>';

  if(mov.tipo !== "settle"){
    html += '<div class="det-sez"><div class="det-sez-h">Diviso così</div>';
    (mov.quote || []).forEach(function(q){
      var extra = pesoLabel(mov.metodo_split, q.peso);
      html += '<div class="det-riga"><span>' + escapeHtml(nomi[q.membro_id] || "?")
        + (extra ? ' <small>' + extra + '</small>' : '') + '</span><span>' + eur(q.importo) + '</span></div>';
    });
    html += '</div>';
  }

  document.getElementById("dettaglio-body").innerHTML = html;
  document.getElementById("modal-dettaglio").classList.add("attivo");
}
function pesoLabel(metodo, peso){
  if(peso == null) return "";
  if(metodo === "percentuale") return peso + "%";
  if(metodo === "quote") return peso + (Number(peso) === 1 ? " quota" : " quote");
  return "";
}
function chiudiDettaglio(){ document.getElementById("modal-dettaglio").classList.remove("attivo"); }

// ════════════════════════════════════════════════════════
//  NUOVA SPESA — con metodi di divisione
// ════════════════════════════════════════════════════════
var metodoSplit = "equo";

function apriNuovaSpesa(){
  document.getElementById("modal-spesa").classList.add("attivo");
  resetFormSpesa();
  setTimeout(function(){ document.getElementById("mv-desc").focus(); }, 100);
}
function chiudiNuovaSpesa(){ document.getElementById("modal-spesa").classList.remove("attivo"); }
function resetFormSpesa(){
  document.getElementById("mv-desc").value = "";
  document.getElementById("mv-imp").value  = "";
  document.getElementById("mv-data").value = new Date().toISOString().slice(0,10);
  renderPaganteSelect();
  metodoSplit = "equo";
  renderSplitUI();
  spesaErrore("");
}
function spesaErrore(m){ document.getElementById("spesa-error").textContent = m || ""; }
function setMetodoSplit(m){ metodoSplit = m; renderSplitUI(); }

function renderSplitUI(){
  document.querySelectorAll(".split-btn").forEach(function(b){
    b.classList.toggle("attivo", b.getAttribute("data-m") === metodoSplit);
  });
  var grid = document.getElementById("split-grid");
  var info = document.getElementById("split-info");

  if(metodoSplit === "equo"){
    grid.innerHTML = "";
    var n = membriCorrente.length;
    info.className = "split-info";
    info.textContent = "Diviso in parti uguali tra " + n + (n === 1 ? " membro" : " membri") + ".";
    return;
  }

  var unit = metodoSplit === "esatto" ? "€" : (metodoSplit === "percentuale" ? "%" : "quote");
  grid.innerHTML = membriCorrente.map(function(m){
    return '<div class="split-row">'
      +   '<span class="split-nome">' + escapeHtml(nomeDi(m)) + '</span>'
      +   '<input class="split-inp" type="number" id="q-' + m.id + '" min="0" step="0.01" '
      +         'inputmode="decimal" placeholder="0" oninput="recalcSplit()">'
      +   '<span class="split-unit">' + unit + '</span>'
      + '</div>';
  }).join("");
  recalcSplit();
}

function recalcSplit(){
  if(metodoSplit === "equo") return;
  var imp    = parseFloat(document.getElementById("mv-imp").value) || 0;
  var inputs = leggiInputSplit();
  var somma  = inputs.reduce(function(a,b){ return a+b; }, 0);
  var info   = document.getElementById("split-info");

  if(metodoSplit === "esatto"){
    var diff = Math.round((imp - somma) * 100) / 100;
    info.textContent = diff === 0 ? "Quadra! ✓" : (diff > 0 ? "Mancano " + eur(diff) : "Eccedono " + eur(-diff));
    info.className = "split-info " + (diff === 0 ? "ok" : "warn");
  } else if(metodoSplit === "percentuale"){
    var d = Math.round((100 - somma) * 10) / 10;
    info.textContent = "Totale " + somma + "% " + (d === 0 ? "✓" : (d > 0 ? "(manca " + d + "%)" : "(+" + (-d) + "%)"));
    info.className = "split-info " + (d === 0 ? "ok" : "warn");
  } else {
    info.textContent = somma > 0 ? "Totale " + somma + " quote" : "Inserisci le quote";
    info.className = "split-info";
  }
}
function leggiInputSplit(){
  return membriCorrente.map(function(m){
    var el = document.getElementById("q-" + m.id);
    return el ? (parseFloat(el.value) || 0) : 0;
  });
}

function calcolaQuote(imp){
  var n = membriCorrente.length;

  if(metodoSplit === "equo"){
    var vals = dividiEquo(imp, n);
    return { quote: membriCorrente.map(function(m, i){ return { membro_id: m.id, importo: vals[i], peso: 1 }; }) };
  }

  var inputs = leggiInputSplit();
  var somma  = inputs.reduce(function(a,b){ return a+b; }, 0);

  if(metodoSplit === "esatto"){
    if(Math.abs(somma - imp) > 0.005)
      return { errore: "La somma delle quote (" + eur(somma) + ") deve fare " + eur(imp) + "." };
    return { quote: membriCorrente.map(function(m, i){
      var v = Math.round(inputs[i] * 100) / 100;
      return { membro_id: m.id, importo: v, peso: v };
    }) };
  }

  if(metodoSplit === "percentuale"){
    if(Math.abs(somma - 100) > 0.01)
      return { errore: "Le percentuali devono sommare 100 (ora " + somma + "%)." };
    var c1 = ripartisciCentesimi(Math.round(imp * 100), inputs);
    return { quote: membriCorrente.map(function(m, i){
      return { membro_id: m.id, importo: c1[i] / 100, peso: inputs[i] };
    }) };
  }

  if(somma <= 0) return { errore: "Inserisci almeno una quota." };
  var c2 = ripartisciCentesimi(Math.round(imp * 100), inputs);
  return { quote: membriCorrente.map(function(m, i){
    return { membro_id: m.id, importo: c2[i] / 100, peso: inputs[i] };
  }) };
}

async function salvaSpesa(){
  var desc      = document.getElementById("mv-desc").value.trim();
  var imp       = parseFloat(document.getElementById("mv-imp").value);
  var paganteId = document.getElementById("mv-pagante").value;
  var data      = document.getElementById("mv-data").value || new Date().toISOString().slice(0,10);

  if(!imp || imp <= 0){ spesaErrore("Inserisci un importo valido."); return; }
  if(!membriCorrente.length){ spesaErrore("Nessun membro nella cassa."); return; }

  var ris = calcolaQuote(imp);
  if(ris.errore){ spesaErrore(ris.errore); return; }
  var quote   = ris.quote;
  var paganti = [{ membro_id: paganteId, importo: imp }];
  var mio = mioMembro();

  var payload = {
    action: "addMovimento", cassa: cassaCorrente.id, tipo: "spesa",
    descrizione: desc, importo: imp, valuta: "EUR", tasso: 1,
    metodo: metodoSplit, data: data, creatoDa: mio ? mio.id : paganteId,
    paganti: paganti, quote: quote
  };

  chiudiNuovaSpesa();
  var temp = {
    id: "temp-" + Date.now(), tipo: "spesa", descrizione: desc, importo: imp,
    valuta_mov: "EUR", tasso_cambio: 1, metodo_split: metodoSplit,
    data: data, paganti: paganti, quote: quote
  };
  S.movimenti.unshift(temp);
  renderCassa();

  try{
    await post(payload);
    await caricaCassa();
  }catch(e){
    if(errDiRete(e)){ /* in coda */ }
    else{
      S.movimenti = S.movimenti.filter(function(m){ return m.id !== temp.id; });
      renderCassa();
      alert("Non è stato possibile salvare la spesa.");
    }
  }
}

// ════════════════════════════════════════════════════════
//  SETTLE-UP
// ════════════════════════════════════════════════════════
var _settleDa = null, _settleA = null;

function apriSettle(daId, aId, importo){
  _settleDa = daId; _settleA = aId;
  var nomi = nomiMembri();
  document.getElementById("settle-da").textContent = nomi[daId] || "?";
  document.getElementById("settle-a").textContent  = nomi[aId]  || "?";
  document.getElementById("settle-imp").value = (importo || 0).toFixed(2);
  settleErrore("");
  document.getElementById("modal-settle").classList.add("attivo");
}
function chiudiSettle(){ document.getElementById("modal-settle").classList.remove("attivo"); }
function settleErrore(m){ document.getElementById("settle-error").textContent = m || ""; }

async function confermaSettle(){
  var imp = parseFloat(document.getElementById("settle-imp").value);
  if(!imp || imp <= 0){ settleErrore("Importo non valido."); return; }
  var mio = mioMembro();
  var data = new Date().toISOString().slice(0,10);

  var paganti = [{ membro_id: _settleDa, importo: imp }];
  var quote   = [{ membro_id: _settleA,  importo: imp }];

  var payload = {
    action: "addMovimento", cassa: cassaCorrente.id, tipo: "settle",
    descrizione: "Rimborso", importo: imp, valuta: "EUR", tasso: 1,
    metodo: "equo", data: data, creatoDa: mio ? mio.id : _settleDa,
    paganti: paganti, quote: quote
  };

  chiudiSettle();
  var temp = {
    id: "temp-" + Date.now(), tipo: "settle", descrizione: "Rimborso",
    importo: imp, valuta_mov: "EUR", tasso_cambio: 1, data: data,
    paganti: paganti, quote: quote
  };
  S.movimenti.unshift(temp);
  renderCassa();

  try{
    await post(payload);
    await caricaCassa();
  }catch(e){
    if(errDiRete(e)){ /* in coda */ }
    else{
      S.movimenti = S.movimenti.filter(function(m){ return m.id !== temp.id; });
      renderCassa();
      alert("Rimborso non salvato.");
    }
  }
}

// ── ELIMINA MOVIMENTO ──
async function eliminaMovimento(id){
  if(String(id).indexOf("temp-") === 0) return;
  if(!confirm("Eliminare questo movimento?")) return;

  var backup = S.movimenti.slice();
  S.movimenti = S.movimenti.filter(function(m){ return m.id !== id; });
  renderCassa();

  try{
    await post({ action: "deleteMovimento", id: id });
  }catch(e){
    if(!errDiRete(e)){ S.movimenti = backup; renderCassa(); alert("Eliminazione non riuscita."); }
  }
}
