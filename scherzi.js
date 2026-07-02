// ════════════════════════════════════════════════════════
//  sPiccioli! — scherzi.js
//  Scherzi tra membri: canale Supabase Realtime BROADCAST
//  "scherzi:"+cassaId. Zero tabelle, zero colonne, zero DB.
//  Gate: sillyAttivo() && !cassaBloccata(). MAI nel Solo.
// ════════════════════════════════════════════════════════
var SCHERZI = [
  { k:"fish",   e:"🐟", n:"Sberla col pesce" },
  { k:"fly",    e:"🪰", n:"La mosca" },
  { k:"boo",    e:"👻", n:"Bu!" },
  { k:"tromba", e:"🎺", n:"Pernacchione" },
  { k:"snail",  e:"🐌", n:"Rallenty" },
  { k:"dance",  e:"💃", n:"Pig-dance" }
];

var _rtScherzi = null;
var _scherziCassaId = null;
var _scherzoUltimoInvio = 0;
var _scherzoTargetUid = null;

// ── ciclo di vita canale (agganciato al render della cassa / uscita cassa) ──
function _syncRealtimeScherzi(){
  if(!cassaCorrente){ chiudiRealtimeScherzi(); _scherziCassaId = null; return; }
  var vuoiAttivo = sillyAttivo() && !cassaBloccata();
  if(vuoiAttivo && _scherziCassaId !== cassaCorrente.id){
    initRealtimeScherzi();
  } else if(!vuoiAttivo && _rtScherzi){
    chiudiRealtimeScherzi();
    _scherziCassaId = null;
  }
}
function initRealtimeScherzi(){
  chiudiRealtimeScherzi();
  if(!cassaCorrente) return;
  _scherziCassaId = cassaCorrente.id;
  _rtScherzi = sb.channel("scherzi:" + cassaCorrente.id)
    .on("broadcast", { event: "scherzo" }, function(msg){ _riceviScherzo((msg && msg.payload) || {}); })
    .subscribe();
}
function chiudiRealtimeScherzi(){
  if(_rtScherzi){ sb.removeChannel(_rtScherzi); _rtScherzi = null; }
}

// ── UI mittente ──
function apriScherzoPicker(uid){
  if(!sillyAttivo() || cassaBloccata()) return;
  _scherzoTargetUid = uid;
  var body = document.getElementById("scherzo-body");
  if(body){
    body.innerHTML = SCHERZI.map(function(s){
      return '<button class="scherzo-btn" onclick="inviaScherzo(\'' + s.k + '\')">'
        + '<span class="scherzo-btn-e">' + s.e + '</span>' + escapeHtml(s.n) + '</button>';
    }).join("");
  }
  document.getElementById("modal-scherzo").classList.add("attivo");
}
function chiudiScherzoPicker(){ document.getElementById("modal-scherzo").classList.remove("attivo"); }

function inviaScherzo(tipo){
  if(!_scherzoTargetUid || !_rtScherzi) return;
  var ora = Date.now();
  if(ora - _scherzoUltimoInvio < 60000){ toastInfo("Calma: uno scherzo al minuto."); return; }
  _scherzoUltimoInvio = ora;
  var mio = mioMembro();
  var daNome = mio ? nomeDi(mio) : "Qualcuno";
  _rtScherzi.send({
    type: "broadcast", event: "scherzo",
    payload: { tipo: tipo, da: daNome, aUid: _scherzoTargetUid }
  });
  chiudiScherzoPicker();
}

// ── ricezione + effetti ──
function _riceviScherzo(p){
  if(!p || !p.tipo) return;
  if(!profiloUtente || p.aUid !== profiloUtente.id) return;   // non è per me
  if(!sillyAttivo() || cassaBloccata()) return;
  var def = SCHERZI.find(function(x){ return x.k === p.tipo; });
  if(!def) return;
  var da = escapeHtml(p.da || "Qualcuno");
  if(_reducedMotion()){ toastInfo(da + " ti ha mandato uno scherzo " + def.e); return; }
  switch(p.tipo){
    case "fish":   _scherzoFish(da); break;
    case "fly":    _scherzoFly(); break;
    case "boo":    _scherzoBoo(); break;
    case "tromba": _scherzoTromba(); break;
    case "snail":  _scherzoSnail(); break;
    case "dance":  _scherzoDance(); break;
  }
}

function _scherzoSpawn(cls, emoji, ms){
  var el = document.createElement("div");
  el.className = cls;
  el.textContent = emoji;
  document.body.appendChild(el);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, ms);
  return el;
}
function _scherzoFish(da){
  toastInfo(da + " ti ha tirato una sberla col pesce 🐟");
  _scherzoSpawn("scherzo-fish", "🐟", 900);
}
function _scherzoFly(){
  var el = _scherzoSpawn("scherzo-fly", "🪰", 10000);
  el.onclick = function(){ if(el.parentNode) el.parentNode.removeChild(el); };
}
function _scherzoBoo(){
  _scherzoSpawn("scherzo-boo", "👻", 1000);
}
function _scherzoTromba(){
  document.body.classList.add("scherzo-shake");
  setTimeout(function(){ document.body.classList.remove("scherzo-shake"); }, 500);
  _scherzoSpawn("scherzo-puff", "💨", 700);
}
function _scherzoSnail(){
  var el = document.getElementById("cassa-screen");
  if(!el) return;
  el.classList.add("scherzo-slowmo");
  setTimeout(function(){ el.classList.remove("scherzo-slowmo"); }, 3000);
}
function _scherzoDance(){
  _scherzoSpawn("scherzo-dance", "🐷", 4000);
}
