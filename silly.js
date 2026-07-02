// ════════════════════════════════════════════════════════
//  sPiccioli! — silly.js
//  S8c: reazioni Silly su eventi-dati. Client-side, emoji+CSS.
//  Gate: cassaCorrente.silly && !prefers-reduced-motion.
// ════════════════════════════════════════════════════════
var SILLY_MIN      = 100;   // sotto: 🐷 minimo
var SILLY_DORME_GG = 7;     // 😴
var SILLY_MORTO_GG = 30;    // 💀
var _sillyEraInPari = null; // fronte di salita coriandoli

function _reducedMotion(){
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function sillyAttivo(){
  return !!(cassaCorrente && cassaCorrente.silly && !_reducedMotion());
}
function _sillyTotaleSpeso(){
  var t = 0;
  (S.movimenti||[]).forEach(function(m){
    if(m.tipo==="settle" || m.origine==="apertura") return;
    t += (parseFloat(m.importo)||0) * (parseFloat(m.tasso_cambio)||1);
  });
  return Math.round(t*100)/100;
}
function sillyTrofeoMovId(){
  if(!sillyAttivo()) return null;
  var max=null, maxv=-1;
  (S.movimenti||[]).forEach(function(m){
    if(m.tipo==="settle" || m.origine==="apertura") return;
    var v=(parseFloat(m.importo)||0)*(parseFloat(m.tasso_cambio)||1);
    if(v>maxv){ maxv=v; max=m.id; }
  });
  return maxv>0 ? max : null;
}
function _sillyGiorniInattiva(){
  var movs=(S.movimenti||[]).filter(function(m){ return m.tipo!=="settle" && m.origine!=="apertura"; });
  if(!movs.length) return null;
  var ultima=null;
  movs.forEach(function(m){ if(!ultima || m.data>ultima) ultima=m.data; });
  if(!ultima) return null;
  return Math.floor((Date.now() - new Date(ultima).getTime())/86400000);
}
function sillyCheck(){
  var stage = document.getElementById("silly-stage");
  if(!stage) return;
  if(!sillyAttivo()){ stage.innerHTML=""; _sillyEraInPari=null; return; }

  // di stato: 🐷 cresce + 😴/💀
  var tot   = _sillyTotaleSpeso();
  var tetto = parseFloat(cassaCorrente.silly_tetto)||1000;
  var scala = Math.max(0, Math.min(1, (tot - SILLY_MIN)/Math.max(1,(tetto - SILLY_MIN))));
  var size  = (0.9 + scala*1.7).toFixed(2);   // 0.9rem → 2.6rem
  var gg    = _sillyGiorniInattiva();
  var inatt = "";
  if(gg!==null && gg>=SILLY_MORTO_GG)      inatt='<span class="silly-inatt" title="Cassa in coma da '+gg+' giorni">💀</span>';
  else if(gg!==null && gg>=SILLY_DORME_GG) inatt='<span class="silly-inatt" title="Nessuna spesa da '+gg+' giorni">😴</span>';
  stage.innerHTML = '<span class="silly-pig" style="font-size:'+size+'rem" title="Speso '+eur(tot)+' su '+eur(tetto)+'">🐷</span>' + inatt;

  // una-tantum: coriandoli sul passaggio a "in pari"
  var saldi = calcolaSaldi();
  var inPari = membriCorrente.length>0 && membriCorrente.every(function(m){ return Math.abs(saldi[m.id]||0) < 0.005; });
  if(_sillyEraInPari===false && inPari) sillyCoriandoli();
  _sillyEraInPari = inPari;
}
function sillyCoriandoli(){
  if(!sillyAttivo()) return;
  var box=document.createElement("div");
  box.className="silly-confetti";
  var em=["🎉","🎊","🐷","✨","💸"];
  for(var i=0;i<28;i++){
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
// toggle + tetto (admin, card Impostazioni)
async function toggleSilly(on){
  var r = await sb.from("casse").update({ silly: on }).eq("id", cassaCorrente.id);
  if(r.error){ alert("Errore: "+r.error.message); return; }
  cassaCorrente.silly = on;
  renderCassa(); renderMembri();
}
async function salvaTettoSilly(v){
  var n = parseFloat(v);
  if(!n || n < 100){ alert("Il tetto minimo è 100."); renderMembri(); return; }
  var r = await sb.from("casse").update({ silly_tetto: n }).eq("id", cassaCorrente.id);
  if(r.error){ alert("Errore: "+r.error.message); return; }
  cassaCorrente.silly_tetto = n;
  renderCassa();
}
