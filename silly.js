// ════════════════════════════════════════════════════════
//  sPiccioli! — silly.js
//  S8c: reazioni Silly su eventi-dati. Client-side, emoji+CSS.
//  Gate: cassaCorrente.silly && !prefers-reduced-motion.
// ════════════════════════════════════════════════════════
var SILLY_MIN      = 100;   // sotto: 🐷 minimo
var SILLY_DORME_GG = 7;     // 😴
var SILLY_MORTO_GG = 30;    // 💀
var _sillyEraInPari = null; // fronte di salita coriandoli
var _sillyRecordSeen = {};  // cassaId → id movimento record già notificato
var _sillyBottaSeen  = {};  // cassaId → id ultimo movimento già valutato per "botta grossa"

function _reducedMotion(){
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function sillyAttivo(){
  return !!(cassaCorrente && cassaCorrente.silly && !_reducedMotion());
}
function _sillyMovValidi(){
  return (S.movimenti||[]).filter(function(m){ return m.tipo!=="settle" && m.origine!=="apertura"; });
}
function _sillyTotaleSpeso(){
  var t = 0;
  _sillyMovValidi().forEach(function(m){
    t += (parseFloat(m.importo)||0) * (parseFloat(m.tasso_cambio)||1);
  });
  return Math.round(t*100)/100;
}
function sillyTrofeoMovId(){
  if(!sillyAttivo()) return null;
  var max=null, maxv=-1;
  _sillyMovValidi().forEach(function(m){
    var v=(parseFloat(m.importo)||0)*(parseFloat(m.tasso_cambio)||1);
    if(v>maxv){ maxv=v; max=m.id; }
  });
  return maxv>0 ? max : null;
}
function _sillyGiorniInattiva(){
  var movs=_sillyMovValidi();
  if(!movs.length) return null;
  var ultima=null;
  movs.forEach(function(m){ if(!ultima || m.data>ultima) ultima=m.data; });
  if(!ultima) return null;
  return Math.floor((Date.now() - new Date(ultima).getTime())/86400000);
}
function _pulseClass(el, cls, ms){
  if(!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;         // forza reflow: permette di ri-animare subito
  el.classList.add(cls);
  setTimeout(function(){ if(el) el.classList.remove(cls); }, ms);
}

// ── 2 · Fissazione: 3 spese consecutive nella stessa categoria ──
function _sillyFissazione(){
  var movs = _sillyMovValidi().slice(0,3);
  if(movs.length < 3) return null;
  var cat = movs[0].categoria;
  if(!cat) return null;
  var stesse = movs.every(function(m){ return m.categoria === cat; });
  return stesse ? cat : null;
}

// ── 7 · Settimana virtuosa: media 7gg < media storica ──
function _sillySettimanaVirtuosa(){
  var movs = _sillyMovValidi();
  if(movs.length < 4) return false;
  var oraMs = Date.now();
  var prima = null, tot7 = 0, totTutto = 0;
  movs.forEach(function(m){
    var v = (parseFloat(m.importo)||0)*(parseFloat(m.tasso_cambio)||1);
    var d = new Date(m.data).getTime();
    if(isNaN(d)) return;
    if(!prima || d < prima) prima = d;
    totTutto += v;
    if(oraMs - d <= 7*86400000) tot7 += v;
  });
  if(!prima) return false;
  var giorniTot = Math.max(1, Math.round((oraMs - prima)/86400000));
  var mediaStorica = totTutto / giorniTot;
  var media7 = tot7 / 7;
  return media7 < mediaStorica * 0.85;   // margine per non lampeggiare sul filo
}

// ── 8 · Spese notturne: movimento creato tra 00:00-05:00, visibile fino alle 06:00 ──
function _sameLocalDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function _sillyNotturno(){
  var now = new Date();
  if(now.getHours() >= 6) return false;
  return _sillyMovValidi().some(function(m){
    if(!m.created_at) return false;
    var c = new Date(m.created_at);
    return !isNaN(c) && _sameLocalDay(c, now) && c.getHours() < 6;
  });
}

// ── 5 · Compleanno cassa: +12 mesi dalla creazione, una volta sola ──
function _sillyCompleanno(){
  if(!cassaCorrente || !cassaCorrente.created_at) return;
  var creata = new Date(cassaCorrente.created_at);
  if(isNaN(creata)) return;
  var now = new Date();
  var anni = now.getFullYear() - creata.getFullYear();
  var isOggi = now.getMonth() === creata.getMonth() && now.getDate() === creata.getDate();
  if(!isOggi || anni < 1) return;
  var key = "spiccioli_bday_" + cassaCorrente.id;
  try{ if(localStorage.getItem(key)) return; localStorage.setItem(key, "1"); }catch(e){}
  toastInfo("🎂 Oggi compio " + anni + (anni===1 ? " anno!" : " anni!"));
  sillyCoriandoli();
}

function sillyCheck(){
  var stage = document.getElementById("silly-stage");
  if(!stage) return;
  if(!sillyAttivo()){ stage.innerHTML=""; _sillyEraInPari=null; return; }

  if(_sillyGreetSeen !== cassaCorrente.id){ _sillyGreetSeen = cassaCorrente.id; _sillyGreeting(); }
  var tema  = (cassaCorrente && cassaCorrente.tema) || "salvadanaio";
  var tot   = _sillyTotaleSpeso();
  var tetto = parseFloat(cassaCorrente.silly_tetto)||1000;
  var oltreTetto = tot > tetto;
  var scala = Math.max(0, Math.min(1, (tot - SILLY_MIN)/Math.max(1,(tetto - SILLY_MIN))));
  var size  = (0.9 + scala*1.7).toFixed(2);   // 0.9rem → 2.6rem

  // 6 · oltre il tetto: 🐷 → 🐗
  var OLTRE_TETTO = { salvadanaio:"🐗", pesci:"🐋", west:"🌵", orsi:"🐻", alieni:"🛸", jungle:"🦍", flamingo:"🦩" };
  var pigEmoji = oltreTetto ? (OLTRE_TETTO[tema] || "🐗") : "🐷";
  var pigTitle = oltreTetto
    ? "Oltre il tetto! La bestia del mondo si è scatenata. Archiviare per placarla."
    : "Speso " + eur(tot) + " su " + eur(tetto);

  // dorme/morto (letargo orsi 🐻💤 al posto di 😴)
  var gg = _sillyGiorniInattiva();
  var inatt = "";
  if(gg!==null && gg>=SILLY_MORTO_GG){
    inatt = '<span class="silly-inatt" title="Cassa in coma da '+gg+' giorni">💀</span>';
  } else if(gg!==null && gg>=SILLY_DORME_GG){
    var dormeEmoji = (tema==="orsi") ? "🐻💤" : "😴";
    inatt = '<span class="silly-inatt" title="Nessuna spesa da '+gg+' giorni">'+dormeEmoji+'</span>';
  }

  // 2 · fissazione
  var fissa = "";
  var catFissa = _sillyFissazione();
  if(catFissa){
    fissa = '<span class="silly-fissa" title="Ancora?!">'+iconaCat(catFissa)+'</span>';
  }

  // 7 · settimana virtuosa
  var virtuosa = _sillySettimanaVirtuosa() ? '<span class="silly-virtuosa" title="Settimana virtuosa">😎</span>' : "";

  // 8 · spese notturne (abduction alieni 🛸 al posto di 🦉)
  var notturnoEmoji = (tema==="alieni") ? "🛸" : "🦉";
  var notturno = _sillyNotturno() ? '<span class="silly-notturno" title="Spese notturne in corso">'+notturnoEmoji+'</span>' : "";

  var _streak = _sillyStreak()>=3 ? '<span class="silly-badge" title="'+_sillyStreak()+' giorni di fila">🔥</span>' : "";
  var _meteo  = _sillyMeteo();
  var _meteoB = _meteo ? '<span class="silly-badge" title="Meteo del mese">'+_meteo+'</span>' : "";
  var _stag   = _sillyStagione();
  stage.innerHTML = '<span class="silly-pig" style="font-size:'+size+'rem" title="'+pigTitle+'" onclick="sillyTapPig(this)">'+pigEmoji+'</span>'
    + inatt + fissa + virtuosa + notturno + _streak + _meteoB + _stag;

  // su touch il tooltip non esiste: tap sul badge → toast col suo testo
  stage.querySelectorAll("span[title]").forEach(function(el){
    if(el.classList.contains("silly-pig")) return;   // il 🐷 ha già il tap-moneta
    el.style.cursor = "pointer";
    el.onclick = function(){ toastInfo(el.getAttribute("title") || ""); };
  });

  // 1 · cambio record: shake trofeo + toast (solo sul reale cambiamento, non al primo check)
  var trofeoId = sillyTrofeoMovId();
  var cid = cassaCorrente.id;
  if(trofeoId){
    if(_sillyRecordSeen[cid] === undefined){
      _sillyRecordSeen[cid] = trofeoId;
    } else if(_sillyRecordSeen[cid] !== trofeoId){
      _sillyRecordSeen[cid] = trofeoId;
      var mov = (S.movimenti||[]).find(function(m){ return m.id === trofeoId; });
      if(mov){
        var v = (parseFloat(mov.importo)||0)*(parseFloat(mov.tasso_cambio)||1);
        var extra = { salvadanaio:" 🪙", pesci:" 🐋", west:" 🌵", orsi:" 🐻", alieni:" 🛸", jungle:" 🦍", flamingo:" 🦩" }[tema] || "";
        toastInfo("🏆 Nuovo record! " + eur(v) + " di gloria." + extra);
        _pulseClass(document.getElementById("mv-trofeo-cur"), "silly-shake", 1000);
      }
    }
  }

  // 3 · botta grossa: 🐷 trema se l'ultimo movimento è ≥ 20% del tetto
  var ultimo = _sillyMovValidi()[0];
  if(ultimo){
    if(_sillyBottaSeen[cid] === undefined){
      _sillyBottaSeen[cid] = ultimo.id;
    } else if(_sillyBottaSeen[cid] !== ultimo.id){
      _sillyBottaSeen[cid] = ultimo.id;
      var vUlt = (parseFloat(ultimo.importo)||0)*(parseFloat(ultimo.tasso_cambio)||1);
      if(vUlt >= tetto*0.2){
        _pulseClass(stage.querySelector(".silly-pig"), "silly-tremor", 2000);
      }
    }
  }

  var _u2 = _sillyMovValidi()[0];
  if(_u2){
    if(_sillyTondaSeen[cid]===undefined){ _sillyTondaSeen[cid]=_u2.id; }
    else if(_sillyTondaSeen[cid]!==_u2.id){
      _sillyTondaSeen[cid]=_u2.id;
      var _vt=(parseFloat(_u2.importo)||0);
      if(_vt>=10 && _vt%10===0){ toastInfo("🎯 Cifra tonda: "+eur(_vt)+" spaccati!"); }
    }
  }

  // 5 · compleanno (una tantum)
  _sillyCompleanno();

  // una-tantum: coriandoli sul passaggio a "in pari"
  var saldi = calcolaSaldi();
  var inPari = membriCorrente.length>0 && membriCorrente.every(function(m){ return Math.abs(saldi[m.id]||0) < 0.005; });
  if(_sillyEraInPari===false && inPari){ sillyCoriandoli(); _sillyLampo(); }
  _sillyEraInPari = inPari;
}
function sillyCoriandoli(){
  if(!sillyAttivo()) return;
  var box=document.createElement("div");
  box.className="silly-confetti";
  var em=["🎉","🎊"].concat(flavorTema().conf || []);
  var nConf=_sillyN(28, 56);
  for(var i=0;i<nConf;i++){
    var s=document.createElement("span");
    s.textContent=em[i%em.length];
    s.style.left=(Math.random()*100)+"%";
    s.style.animationDelay=(Math.random()*0.4)+"s";
    s.style.fontSize=(0.9+Math.random()*1.1)+"rem";
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(function(){ if(box.parentNode) box.parentNode.removeChild(box); }, 2600);
}

// ── 4 · Pioggia di monete sul bottone, al salvataggio di un rimborso ──
function sillyPioggiaMonete(btn){
  if(!sillyAttivo() || !btn) return;
  var r = btn.getBoundingClientRect();
  var box = document.createElement("div");
  box.className = "silly-coinrain";
  box.style.left = r.left + "px";
  box.style.top  = r.top + "px";
  box.style.width  = r.width + "px";
  box.style.height = r.height + "px";
  var em = ["💰","🪙"];
  var nCoin = _sillyN(10, 20);
  for(var i=0;i<nCoin;i++){
    var s = document.createElement("span");
    s.textContent = em[i%em.length];
    s.style.left = (Math.random()*100)+"%";
    s.style.animationDelay = (Math.random()*0.25)+"s";
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(function(){ if(box.parentNode) box.parentNode.removeChild(box); }, 1400);
}

// toggle + tetto (admin, card Impostazioni)
async function toggleSilly(on){
  var r = await sb.from("casse").update({ silly: on }).eq("id", cassaCorrente.id);
  if(r.error){ await alertBrand("Errore: "+r.error.message); return; }
  cassaCorrente.silly = on;
  if(on){ try{ if(!localStorage.getItem("spiccioli_silly_hint")){ localStorage.setItem("spiccioli_silly_hint","1"); await alertBrand("🐷 Silly acceso!\nDà personalità al mondo: emoji a tema, sorprese e il maialino che combina guai.\nNon tocca un centesimo — i conti restano seri."); } }catch(e){} }
  renderCassa(); renderMembri();
}
async function salvaTettoSilly(v){
  var n = parseFloat(v);
  if(!n || n < 100){ await alertBrand("Sotto i 100 il maialino muore di fame: minimo 100."); renderMembri(); return; }
  var r = await sb.from("casse").update({ silly_tetto: n }).eq("id", cassaCorrente.id);
  if(r.error){ await alertBrand("Errore: "+r.error.message); return; }
  cassaCorrente.silly_tetto = n;
  renderCassa();
}


// ══════════ LOTTO 4-7 · livelli · reazioni · stagioni (client-side, no DB) ══════════
var _sillyTondaSeen = {};
var _sillyGreetSeen = null;
function sillyLivello(){
  if(!sillyAttivo()) return "off";
  try{ return localStorage.getItem("spiccioli_silly_liv")==="sopra" ? "sopra" : "elegante"; }catch(e){ return "elegante"; }
}
function _sillyN(elegante, sopra){ return sillyLivello()==="sopra" ? sopra : elegante; }
function _sillyLivSeg(withOff){
  var on=!!(cassaCorrente&&cassaCorrente.silly), liv="elegante";
  try{ if(localStorage.getItem("spiccioli_silly_liv")==="sopra") liv="sopra"; }catch(e){}
  var s='<div class="split-seg" style="margin-bottom:14px;">';
  if(withOff) s+='<button class="split-btn '+(!on?"attivo":"")+'" onclick="setSilly(\'off\')">Off</button>';
  s+='<button class="split-btn '+((on&&liv==="elegante")?"attivo":"")+'" onclick="setSilly(\'elegante\')">✨ Elegante</button>';
  s+='<button class="split-btn '+((on&&liv==="sopra")?"attivo":"")+'" title="Sopra le righe" onclick="setSilly(\'sopra\')">🎉 Sopra</button>';
  return s+'</div>';
}
async function setSilly(mode){
  if(mode==="off"){ if(cassaCorrente&&cassaCorrente.silly){ await toggleSilly(false); } else { renderMembri(); } return; }
  try{ localStorage.setItem("spiccioli_silly_liv", mode==="sopra"?"sopra":"elegante"); }catch(e){}
  if(cassaCorrente&&!cassaCorrente.silly){ await toggleSilly(true); }
  else { renderCassa(); renderMembri(); }
}
function _sillyDayKey(d){ return d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate(); }
function _sillyStreak(){
  var movs=_sillyMovValidi(); if(!movs.length) return 0;
  var days={}; movs.forEach(function(m){ var d=new Date(m.data); if(!isNaN(d)) days[_sillyDayKey(d)]=1; });
  var cur=new Date(), streak=0;
  if(!days[_sillyDayKey(cur)]){ cur.setDate(cur.getDate()-1); if(!days[_sillyDayKey(cur)]) return 0; }
  while(days[_sillyDayKey(cur)]){ streak++; cur.setDate(cur.getDate()-1); }
  return streak;
}
function _sillyMeteo(){
  var movs=_sillyMovValidi(); if(movs.length<3) return "";
  var now=Date.now(), t30=0, tPrev=0;
  movs.forEach(function(m){
    var v=(parseFloat(m.importo)||0)*(parseFloat(m.tasso_cambio)||1);
    var d=new Date(m.data).getTime(); if(isNaN(d)) return;
    var age=now-d;
    if(age<=2592000000) t30+=v; else if(age<=5184000000) tPrev+=v;
  });
  if(tPrev<=0) return "";
  var r=t30/tPrev;
  if(r>1.25) return "⛈️"; if(r>0.9) return "🌦️"; return "☀️";
}
function sillyReMese(){
  if(!sillyAttivo()) return null;
  var now=new Date(), y=now.getFullYear(), mo=now.getMonth(), tot={};
  (S.movimenti||[]).forEach(function(m){
    if(m.tipo==="settle"||m.origine==="apertura") return;
    var d=new Date(m.data); if(isNaN(d)||d.getFullYear()!==y||d.getMonth()!==mo) return;
    var t=parseFloat(m.tasso_cambio)||1;
    (m.paganti||[]).forEach(function(p){ if(p&&p.membro_id) tot[p.membro_id]=(tot[p.membro_id]||0)+(parseFloat(p.importo)||0)*t; });
  });
  var best=null, bv=0;
  Object.keys(tot).forEach(function(k){ if(tot[k]>bv){ bv=tot[k]; best=k; } });
  return bv>0 ? best : null;
}
function _sillyLampo(){
  if(!sillyAttivo()) return;
  var u=_sillyMovValidi()[0]; if(!u||!u.created_at) return;
  if(Date.now()-new Date(u.created_at).getTime() <= 3600000) toastInfo("⚡ Pareggio lampo! Che velocità.");
}
function sillyTapPig(el){
  if(!sillyAttivo()||_reducedMotion()||!el) return;
  var r=el.getBoundingClientRect();
  var s=document.createElement("span");
  s.className="silly-coin-pop"; s.textContent="🪙";
  s.style.left=(r.left+r.width/2)+"px"; s.style.top=r.top+"px";
  document.body.appendChild(s);
  setTimeout(function(){ if(s.parentNode) s.parentNode.removeChild(s); }, 900);
}
function _sillyStagione(){
  var d=new Date(), m=d.getMonth(), day=d.getDate();
  if(m===11) return '<span class="silly-badge" title="Aria di feste">❄️</span>';
  if(m===9 && day>=25) return '<span class="silly-badge" title="Halloween">🎃</span>';
  return "";
}
function _sillyGreeting(){
  if(!sillyAttivo()||_reducedMotion()) return;
  var tema=(cassaCorrente&&cassaCorrente.tema)||"salvadanaio";
  var e=({salvadanaio:"🐷",pesci:"🐟",west:"🤠",orsi:"🐻",alieni:"👽",jungle:"🦜",flamingo:"🦩"})[tema]||"🐷";
  var g=document.createElement("div"); g.className="silly-greet"; g.textContent=e;
  document.body.appendChild(g);
  setTimeout(function(){ if(g.parentNode) g.parentNode.removeChild(g); }, 1300);
}
