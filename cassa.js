// ════════════════════════════════════════════════════════
//  sPiccioli! — cassa.js
//  UI dentro la cassa: tab (Conti/Membri), saldi, movimenti,
//  spesa, settle, dettaglio, gestione membri/cassa.
// ════════════════════════════════════════════════════════

// ── INTESTAZIONE / TAB ──
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
function switchCassaTab(tab){
  document.querySelectorAll("#cassa-screen .cassa-tab").forEach(function(t){
    t.classList.toggle("attiva", t.getAttribute("data-tab") === tab);
  });
  document.querySelectorAll(".cassa-nav button").forEach(function(b){
    b.classList.toggle("attiva", b.getAttribute("data-tab") === tab);
  });
  if(tab === "membri") renderMembri();
}

// nome con fallback: membro → profilo → "Senza nome". Cerca tra TUTTI i membri.
function nomeDi(m){
  if(!m) return "?";
  if(m.nome && m.nome.trim()) return m.nome.trim();
  if(m.profili && m.profili.nome && m.profili.nome.trim()) return m.profili.nome.trim();
  return "Senza nome";
}
function nomiMembri(){
  var n = {};
  (membriTutti || []).forEach(function(m){ n[m.id] = nomeDi(m); });
  return n;
}

// ── RENDER PRINCIPALE ──
function renderCassa(){
  renderSaldi();
  renderPaganteSelect();
  renderMovimenti();
  var mt = document.querySelector('#cassa-screen .cassa-tab[data-tab="membri"]');
  if(mt && mt.classList.contains("attiva")) renderMembri();
}

// ── SALDI ──
function renderSaldi(){
  var saldi  = calcolaSaldi();
  var titolo = document.getElementById("saldi-titolo");
  var wrap   = document.getElementById("saldi-list");
  var extra  = document.getElementById("settle-extra");
  extra.innerHTML = "";

  // Modalità grezza: solo comune + esattamente 2 membri attivi
  if(cassaCorrente.modalita === "comune" && cassaCorrente.grezza && membriCorrente.length === 2){
    return renderGrezza(saldi);
  }

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
    return '<div class="saldo-membro"><span class="sm-nome">' + escapeHtml(nomi[m.id]) + '</span>'
      + '<span class="sm-val ' + cls + '">' + seg + eur(Math.abs(s)) + '<small>' + lbl + '</small></span></div>';
  }).join("");

  var debiti = simplificaDebiti(saldi);
  if(debiti.length){
    extra.innerHTML = '<div class="card"><div class="card-titolo">Salda i conti</div>'
      + debiti.map(rigaDebito).join("") + '</div>';
  }
}
function renderGrezza(saldi){
  document.getElementById("settle-extra").innerHTML = "";
  document.getElementById("saldi-titolo").textContent = "I conti (grezza)";
  var wrap = document.getElementById("saldi-list");
  var ids  = membriCorrente.map(function(m){ return m.id; });
  var a = saldi[ids[0]] || 0, b = saldi[ids[1]] || 0;
  var gap = Math.abs(a - b);                       // divario di spesa = 2× il netto
  if(gap < 0.005){ wrap.innerHTML = '<div class="saldi-pari">In pari! 🎉</div>'; return; }
  var nomi  = nomiMembri();
  var debId = a < b ? ids[0] : ids[1];
  var creId = a < b ? ids[1] : ids[0];
  wrap.innerHTML = '<div class="grezza-box">'
    + '<div class="grezza-frase"><b>' + escapeHtml(nomi[debId]) + '</b> è indietro di <b>' + eur(gap)
    + '</b> rispetto a <b>' + escapeHtml(nomi[creId]) + '</b></div>'
    + '<div class="grezza-nota">Modalità grezza: si pareggia spendendo di più, non in contanti.</div>'
    + '</div>';
}
function rigaDebito(d){
  var nomi = nomiMembri();
  return '<div class="riga-debito">'
    +   '<div class="rd-txt"><b>' + escapeHtml(nomi[d.da] || "?") + '</b> deve '
    +     '<b>' + eur(d.importo) + '</b> a <b>' + escapeHtml(nomi[d.a] || "?") + '</b></div>'
    +   '<button class="btn-salda" onclick="apriSettle(\'' + d.da + '\',\'' + d.a + '\',' + d.importo + ')">Salda</button>'
    + '</div>';
}

function renderPaganteSelect(){
  var sel = document.getElementById("mv-pagante");
  var mio = mioMembro();
  sel.innerHTML = membriCorrente.map(function(m){
    var s = (mio && m.id === mio.id) ? " selected" : "";
    return '<option value="' + m.id + '"' + s + '>' + escapeHtml(nomeDi(m)) + '</option>';
  }).join("");
}

// ── LISTA MOVIMENTI ──
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
    var val  = mov.valuta_mov || "EUR";
    var del  = '<button class="mv-del" onclick="event.stopPropagation();eliminaMovimento(\'' + mov.id + '\')" title="Elimina">×</button>';
    var apri = temp ? "" : ' onclick="apriDettaglio(\'' + mov.id + '\')"';

    if(mov.tipo === "settle"){
      var da = nomi[(mov.paganti[0] || {}).membro_id] || "?";
      var a  = nomi[(mov.quote[0]   || {}).membro_id] || "?";
      return '<div class="mv-item mv-settle' + (temp ? " mv-temp" : "") + '"' + apri + '>'
        +   '<div class="mv-main"><div class="mv-desc">💸 Rimborso</div>'
        +     '<div class="mv-meta">' + fmt(mov.data) + ' · ' + escapeHtml(da) + ' → ' + escapeHtml(a) + '</div></div>'
        +   '<div class="mv-imp">' + importoCon(mov.importo, val) + '</div>' + del
        + '</div>';
    }

    var pag = (mov.paganti || []).map(function(p){ return escapeHtml(nomi[p.membro_id] || "?"); }).join(", ");
    var badge = (mov.metodo_split && mov.metodo_split !== "equo")
      ? '<span class="mv-badge">' + etichettaMetodo(mov.metodo_split) + '</span>' : '';
    var valBadge = (val !== (cassaCorrente.valuta_base||"EUR")) ? '<span class="mv-badge">' + val + '</span>' : '';
    return '<div class="mv-item' + (temp ? " mv-temp" : "") + '"' + apri + '>'
      +   '<div class="mv-main">'
      +     '<div class="mv-desc">' + escapeHtml(mov.descrizione || "(senza descrizione)") + badge + valBadge + '</div>'
      +     '<div class="mv-meta">' + fmt(mov.data) + ' · pagato da ' + (pag || "—") + '</div>'
      +   '</div>'
      +   '<div class="mv-imp">' + importoCon(mov.importo, val) + '</div>' + del
      + '</div>';
  }).join("");
}
function etichettaMetodo(m){ return { esatto:"importi", percentuale:"%", quote:"quote" }[m] || m; }

// ── DETTAGLIO MOVIMENTO ──
function apriDettaglio(id){
  if(String(id).indexOf("temp-") === 0) return;
  var mov = (S.movimenti || []).find(function(m){ return String(m.id) === String(id); });
  if(!mov) return;
  var nomi = nomiMembri();
  var val  = mov.valuta_mov || "EUR";
  var base = cassaCorrente.valuta_base || "EUR";
  var tasso = parseFloat(mov.tasso_cambio) || 1;

  var titolo = mov.tipo === "settle" ? "💸 Rimborso" : (mov.descrizione || "(senza descrizione)");
  var html = '<div class="det-top"><div class="det-titolo">' + escapeHtml(titolo) + '</div>'
    +   '<div class="det-imp">' + importoCon(mov.importo, val) + '</div>'
    +   '<div class="det-data">' + fmtLong(mov.data) + '</div>';
  if(val !== base){
    html += '<div class="det-cambio">Tasso: 1 ' + val + ' = ' + (Math.round(tasso*10000)/10000) + ' ' + base
         + ' · ≈ ' + eur(mov.importo * tasso) + '</div>';
  }
  html += '</div>';

  html += '<div class="det-sez"><div class="det-sez-h">Pagato da</div>';
  (mov.paganti || []).forEach(function(p){
    html += '<div class="det-riga"><span>' + escapeHtml(nomi[p.membro_id] || "?") + '</span><span>' + importoCon(p.importo, val) + '</span></div>';
  });
  html += '</div>';

  if(mov.tipo !== "settle"){
    html += '<div class="det-sez"><div class="det-sez-h">Diviso così</div>';
    (mov.quote || []).forEach(function(q){
      var extra = pesoLabel(mov.metodo_split, q.peso);
      html += '<div class="det-riga"><span>' + escapeHtml(nomi[q.membro_id] || "?")
        + (extra ? ' <small>' + extra + '</small>' : '') + '</span><span>' + importoCon(q.importo, val) + '</span></div>';
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
//  TAB MEMBRI — gestione
// ════════════════════════════════════════════════════════
function renderMembri(){
  var nomi  = nomiMembri();
  var saldi = calcolaSaldi();
  var mioId = (mioMembro() || {}).id;
  var admin = cassaCorrente.ruolo === "admin";

  var righe = membriCorrente.map(function(m){
    var s = saldi[m.id] || 0;
    var stato = Math.abs(s) < 0.005 ? '<span class="mb-pari">in pari</span>'
      : (s > 0 ? '<span class="mb-cred">+' + eur(s) + '</span>' : '<span class="mb-deb">−' + eur(Math.abs(s)) + '</span>');
    var ruolo = m.ruolo === "admin" ? '<span class="cassa-badge-admin">admin</span>' : '';
    var tu    = m.id === mioId ? '<span class="cassa-badge-tu">tu</span>' : '';
    var puoiRinominare = true;  // app silly: chiunque puo rinominare chiunque
    var puoiRimuovere  = admin && m.id !== mioId && Math.abs(s) < 0.005;
    var az = '';
    if(puoiRinominare) az += '<button class="mb-btn" onclick="apriRinomina(\'' + m.id + '\')" title="Rinomina">✏️</button>';
    if(puoiRimuovere)  az += '<button class="mb-btn" onclick="rimuoviMembro(\'' + m.id + '\')" title="Rimuovi">🗑️</button>';
    return '<div class="mb-row"><div class="mb-info">'
      + '<div class="mb-nome">' + escapeHtml(nomi[m.id]) + ' ' + tu + ruolo + '</div>'
      + '<div class="mb-stato">' + stato + '</div></div>'
      + '<div class="mb-azioni">' + az + '</div></div>';
  }).join("");

  var html = '<div class="card"><div class="card-titolo">Membri (' + membriCorrente.length + ')</div>' + righe + '</div>';

  html += '<div class="card"><div class="card-titolo">Codice cassa</div>'
    + '<div class="codice-big">' + escapeHtml(cassaCorrente.codice_invito) + '</div>'
    + (admin ? '<button class="mb-azione-btn" onclick="rigeneraCodice()">🔄 Rigenera codice</button>' : '')
    + '</div>';

  if(admin){
    var set = '';
    if(cassaCorrente.modalita === "comune" && membriCorrente.length === 2){
      set += '<label class="mb-toggle-row"><span>Modalità grezza<small>Mostra il divario di spesa invece del saldo</small></span>'
        + '<input type="checkbox" ' + (cassaCorrente.grezza ? "checked" : "") + ' onchange="toggleGrezza(this.checked)"></label>';
    }
    set += '<button class="mb-danger" onclick="apriEliminaCassa()">🗑️ Elimina cassa</button>';
    html += '<div class="card"><div class="card-titolo">Impostazioni</div>' + set + '</div>';
  }

  document.getElementById("membri-body").innerHTML = html;
}

// ── RINOMINA ──
var _rinominaId = null;
function apriRinomina(id){
  _rinominaId = id;
  var m = (membriTutti || []).find(function(x){ return x.id === id; });
  document.getElementById("rinomina-input").value = (m && m.nome) || "";
  rinominaErrore("");
  document.getElementById("modal-rinomina").classList.add("attivo");
  setTimeout(function(){ document.getElementById("rinomina-input").focus(); }, 100);
}
function chiudiRinomina(){ document.getElementById("modal-rinomina").classList.remove("attivo"); }
function rinominaErrore(m){ document.getElementById("rinomina-error").textContent = m || ""; }
async function confermaRinomina(){
  var nome = document.getElementById("rinomina-input").value.trim();
  if(!nome){ rinominaErrore("Scegli un nome."); return; }
  var r = await sb.rpc("rinomina_membro", { p_membro: _rinominaId, p_nome: nome });
  if(r.error){ rinominaErrore("Errore: " + r.error.message); return; }
  chiudiRinomina();
  await caricaCassa();
  renderMembri();
}

// ── RIMUOVI MEMBRO (admin, solo se in pari) ──
async function rimuoviMembro(id){
  var nomi = nomiMembri();
  if(!confirm("Rimuovere " + (nomi[id] || "questo membro") + " dalla cassa?\nI suoi movimenti passati restano.")) return;
  var r = await sb.from("membri").update({ attivo: false }).eq("id", id);
  if(r.error){ alert("Errore: " + r.error.message); return; }
  await caricaCassa();
  renderMembri();
}

// ── RIGENERA CODICE (admin) ──
async function rigeneraCodice(){
  if(!confirm("Generare un nuovo codice? Quello vecchio smetterà di funzionare.")) return;
  var r = await sb.rpc("rigenera_codice", { p_cassa: cassaCorrente.id });
  if(r.error){ alert("Errore: " + r.error.message); return; }
  cassaCorrente.codice_invito = r.data;
  renderMembri();
}

// ── TOGGLE GREZZA (admin) ──
async function toggleGrezza(on){
  var r = await sb.from("casse").update({ grezza: on }).eq("id", cassaCorrente.id);
  if(r.error){ alert("Errore: " + r.error.message); return; }
  cassaCorrente.grezza = on;
  renderCassa();
}

// ── ELIMINA CASSA (admin, conferma col nome) ──
function apriEliminaCassa(){
  document.getElementById("elimina-nome-target").textContent = cassaCorrente.nome;
  document.getElementById("elimina-input").value = "";
  document.getElementById("elimina-btn").disabled = true;
  eliminaErrore("");
  document.getElementById("modal-elimina").classList.add("attivo");
}
function chiudiEliminaCassa(){ document.getElementById("modal-elimina").classList.remove("attivo"); }
function eliminaErrore(m){ document.getElementById("elimina-error").textContent = m || ""; }
function controllaNomeElimina(){
  var ok = document.getElementById("elimina-input").value.trim() === cassaCorrente.nome;
  document.getElementById("elimina-btn").disabled = !ok;
}
async function confermaEliminaCassa(){
  if(document.getElementById("elimina-input").value.trim() !== cassaCorrente.nome) return;
  var r = await sb.from("casse").delete().eq("id", cassaCorrente.id);
  if(r.error){ eliminaErrore("Errore: " + r.error.message); return; }
  chiudiEliminaCassa();
  tornaAlleCasse();
}

// ════════════════════════════════════════════════════════
//  NUOVA SPESA — valuta, paganti multipli, metodi di split
// ════════════════════════════════════════════════════════
var metodoSplit    = "equo";
var valutaCorrente = "EUR";
var tassoCorrente  = 1;

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
  document.getElementById("mv-multipagante").checked = false;
  var base = cassaCorrente.valuta_base || "EUR";
  document.getElementById("mv-valuta").value = base;
  valutaCorrente = base; tassoCorrente = 1;
  document.getElementById("mv-imp-valuta").textContent = base;
  document.getElementById("mv-tasso-row").style.display = "none";
  renderPaganteSelect();
  renderPaganteUI();
  metodoSplit = "equo";
  renderSplitUI();
  spesaErrore("");
}
function spesaErrore(m){ document.getElementById("spesa-error").textContent = m || ""; }
function recalcImporto(){ recalcSplit(); recalcPaganti(); }

async function aggiornaTasso(){
  var v = document.getElementById("mv-valuta").value;
  valutaCorrente = v;
  document.getElementById("mv-imp-valuta").textContent = v;
  aggiornaUnitaValuta();
  var base = cassaCorrente.valuta_base || "EUR";
  var row  = document.getElementById("mv-tasso-row");
  var manuale = document.getElementById("mv-tasso-manuale-wrap");
  if(v === base){ tassoCorrente = 1; row.style.display = "none"; recalcImporto(); return; }
  row.style.display = "block"; manuale.style.display = "none";
  document.getElementById("mv-tasso-info").textContent = "Recupero il tasso…";
  try{
    var url = "https://api.frankfurter.dev/v1/latest?base=" + v + "&symbols=" + base;
    var res = await fetch(url);
    var data = await res.json();
    var t = data && data.rates && data.rates[base];
    if(!t) throw new Error("no rate");
    tassoCorrente = t;
    document.getElementById("mv-tasso-info").textContent = "1 " + v + " = " + (Math.round(t*10000)/10000) + " " + base + " (oggi)";
  }catch(e){
    tassoCorrente = null;
    document.getElementById("mv-tasso-info").textContent = "Tasso non disponibile — inseriscilo a mano:";
    document.getElementById("mv-tasso-lbl").textContent = "1 " + v + " in " + base;
    manuale.style.display = "block";
  }
  recalcImporto();
}
function aggiornaUnitaValuta(){
  if(metodoSplit === "esatto"){
    document.querySelectorAll("#split-grid .split-unit").forEach(function(u){ u.textContent = valutaCorrente; });
  }
  document.querySelectorAll("#paganti-grid .split-unit").forEach(function(u){ u.textContent = valutaCorrente; });
}

// paganti singolo/multiplo
function renderPaganteUI(){
  var multi = document.getElementById("mv-multipagante").checked;
  document.getElementById("pagante-single").style.display = multi ? "none" : "block";
  document.getElementById("pagante-multi").style.display  = multi ? "block" : "none";
  if(multi) renderPagantiGrid();
}
function renderPagantiGrid(){
  document.getElementById("paganti-grid").innerHTML = membriCorrente.map(function(m){
    return '<div class="split-row"><span class="split-nome">' + escapeHtml(nomeDi(m)) + '</span>'
      + '<input class="split-inp" type="number" id="p-' + m.id + '" min="0" step="0.01" inputmode="decimal" '
      + 'placeholder="0" oninput="recalcPaganti()"><span class="split-unit">' + valutaCorrente + '</span></div>';
  }).join("");
  recalcPaganti();
}
function recalcPaganti(){
  if(!document.getElementById("mv-multipagante").checked) return;
  var imp = parseFloat(document.getElementById("mv-imp").value) || 0;
  var somma = membriCorrente.reduce(function(a, m){
    var el = document.getElementById("p-" + m.id);
    return a + (el ? (parseFloat(el.value) || 0) : 0);
  }, 0);
  var diff = Math.round((imp - somma) * 100) / 100;
  var info = document.getElementById("paganti-info");
  info.textContent = diff === 0 ? "Quadra! ✓"
    : (diff > 0 ? "Mancano " + importoCon(diff, valutaCorrente) : "Eccedono " + importoCon(-diff, valutaCorrente));
  info.className = "split-info " + (diff === 0 ? "ok" : "warn");
}
function calcolaPaganti(imp){
  if(!document.getElementById("mv-multipagante").checked){
    return { paganti: [{ membro_id: document.getElementById("mv-pagante").value, importo: imp }] };
  }
  var arr = [], somma = 0;
  membriCorrente.forEach(function(m){
    var el = document.getElementById("p-" + m.id);
    var v  = el ? (parseFloat(el.value) || 0) : 0;
    if(v > 0){ arr.push({ membro_id: m.id, importo: Math.round(v*100)/100 }); somma += v; }
  });
  if(!arr.length) return { errore: "Indica chi ha pagato." };
  if(Math.abs(somma - imp) > 0.005)
    return { errore: "I paganti (" + importoCon(somma, valutaCorrente) + ") devono fare " + importoCon(imp, valutaCorrente) + "." };
  return { paganti: arr };
}

// metodi di split
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
  var unit = metodoSplit === "esatto" ? valutaCorrente : (metodoSplit === "percentuale" ? "%" : "quote");
  grid.innerHTML = membriCorrente.map(function(m){
    return '<div class="split-row"><span class="split-nome">' + escapeHtml(nomeDi(m)) + '</span>'
      + '<input class="split-inp" type="number" id="q-' + m.id + '" min="0" step="0.01" inputmode="decimal" '
      + 'placeholder="0" oninput="recalcSplit()"><span class="split-unit">' + unit + '</span></div>';
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
    info.textContent = diff === 0 ? "Quadra! ✓"
      : (diff > 0 ? "Mancano " + importoCon(diff, valutaCorrente) : "Eccedono " + importoCon(-diff, valutaCorrente));
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
      return { errore: "La somma delle quote (" + importoCon(somma, valutaCorrente) + ") deve fare " + importoCon(imp, valutaCorrente) + "." };
    return { quote: membriCorrente.map(function(m, i){ var v = Math.round(inputs[i]*100)/100; return { membro_id: m.id, importo: v, peso: v }; }) };
  }
  if(metodoSplit === "percentuale"){
    if(Math.abs(somma - 100) > 0.01)
      return { errore: "Le percentuali devono sommare 100 (ora " + somma + "%)." };
    var c1 = ripartisciCentesimi(Math.round(imp * 100), inputs);
    return { quote: membriCorrente.map(function(m, i){ return { membro_id: m.id, importo: c1[i]/100, peso: inputs[i] }; }) };
  }
  if(somma <= 0) return { errore: "Inserisci almeno una quota." };
  var c2 = ripartisciCentesimi(Math.round(imp * 100), inputs);
  return { quote: membriCorrente.map(function(m, i){ return { membro_id: m.id, importo: c2[i]/100, peso: inputs[i] }; }) };
}

async function salvaSpesa(){
  var desc = document.getElementById("mv-desc").value.trim();
  var imp  = parseFloat(document.getElementById("mv-imp").value);
  var data = document.getElementById("mv-data").value || new Date().toISOString().slice(0,10);
  var base = cassaCorrente.valuta_base || "EUR";
  if(!imp || imp <= 0){ spesaErrore("Inserisci un importo valido."); return; }
  if(!membriCorrente.length){ spesaErrore("Nessun membro nella cassa."); return; }

  var tasso = 1;
  if(valutaCorrente !== base){
    tasso = tassoCorrente;
    if(tasso == null) tasso = parseFloat(document.getElementById("mv-tasso-manuale").value);
    if(!tasso || tasso <= 0){ spesaErrore("Inserisci il tasso di cambio."); return; }
  }

  var rp = calcolaPaganti(imp); if(rp.errore){ spesaErrore(rp.errore); return; }
  var rq = calcolaQuote(imp);   if(rq.errore){ spesaErrore(rq.errore); return; }
  var paganti = rp.paganti, quote = rq.quote;
  var mio = mioMembro();

  var payload = {
    action: "addMovimento", cassa: cassaCorrente.id, tipo: "spesa",
    descrizione: desc, importo: imp, valuta: valutaCorrente, tasso: tasso,
    metodo: metodoSplit, data: data, creatoDa: mio ? mio.id : paganti[0].membro_id,
    paganti: paganti, quote: quote
  };

  chiudiNuovaSpesa();
  var temp = {
    id: "temp-" + Date.now(), tipo: "spesa", descrizione: desc, importo: imp,
    valuta_mov: valutaCorrente, tasso_cambio: tasso, metodo_split: metodoSplit,
    data: data, paganti: paganti, quote: quote
  };
  S.movimenti.unshift(temp);
  renderCassa();
  try{
    await post(payload);
    await caricaCassa();
  }catch(e){
    if(errDiRete(e)){}
    else{ S.movimenti = S.movimenti.filter(function(m){ return m.id !== temp.id; }); renderCassa(); alert("Non è stato possibile salvare la spesa."); }
  }
}

// ── SETTLE-UP ──
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
  var base = cassaCorrente.valuta_base || "EUR";
  var paganti = [{ membro_id: _settleDa, importo: imp }];
  var quote   = [{ membro_id: _settleA,  importo: imp }];
  var payload = {
    action: "addMovimento", cassa: cassaCorrente.id, tipo: "settle",
    descrizione: "Rimborso", importo: imp, valuta: base, tasso: 1,
    metodo: "equo", data: data, creatoDa: mio ? mio.id : _settleDa,
    paganti: paganti, quote: quote
  };
  chiudiSettle();
  var temp = { id: "temp-" + Date.now(), tipo: "settle", descrizione: "Rimborso",
    importo: imp, valuta_mov: base, tasso_cambio: 1, data: data, paganti: paganti, quote: quote };
  S.movimenti.unshift(temp);
  renderCassa();
  try{ await post(payload); await caricaCassa(); }
  catch(e){
    if(errDiRete(e)){}
    else{ S.movimenti = S.movimenti.filter(function(m){ return m.id !== temp.id; }); renderCassa(); alert("Rimborso non salvato."); }
  }
}

// ── ELIMINA MOVIMENTO ──
async function eliminaMovimento(id){
  if(String(id).indexOf("temp-") === 0) return;
  if(!confirm("Eliminare questo movimento?")) return;
  var backup = S.movimenti.slice();
  S.movimenti = S.movimenti.filter(function(m){ return m.id !== id; });
  renderCassa();
  try{ await post({ action: "deleteMovimento", id: id }); }
  catch(e){ if(!errDiRete(e)){ S.movimenti = backup; renderCassa(); alert("Eliminazione non riuscita."); } }
}
