// ════════════════════════════════════════════════════════
//  sPiccioli! — welcome.js
//  Slide di benvenuto al primo accesso (first-run) + FAQ toggle.
//  Copy SEGNAPOSTO (testi definitivi al pass finale, Claude Design).
//  Riusa il guscio .info-overlay per lo stile.
// ════════════════════════════════════════════════════════

var WELCOME_KEY = "spiccioli_welcome_visto";
var _welcomeIdx = 0;
var WELCOME_SLIDES = [
  { emoji:"🐷", titolo:"Benvenuto in sPiccioli!", testo:"Tieni da conto le piccole spese — i Piccioli — da solo, in due o in gruppo." },
  { emoji:"👥", titolo:"Solo, Coppia o Gruppo",   testo:"Crea una cassa e adattala a come dividete le spese. Ognuno vede la sua quota." },
  { emoji:"🧺", titolo:"Lista, Note e Grafici",    testo:"Condividete la lista della spesa, lasciate note sulla bacheca, guardate chi ha speso cosa." },
  { emoji:"✨", titolo:"Resta Silly",              testo:"Dai il giusto peso alle cose piccole ma importanti. Pronti a iniziare?" }
];

function maybeWelcome(){
  try{ if(localStorage.getItem(WELCOME_KEY) === "1") return; }catch(e){ return; }
  _welcomeIdx = 0;
  var ov = document.getElementById("welcome-overlay");
  if(!ov) return;
  ov.classList.add("attivo");
  renderWelcome();
}
function renderWelcome(){
  var s = WELCOME_SLIDES[_welcomeIdx];
  var body = document.getElementById("welcome-body");
  if(!body) return;
  body.innerHTML =
      '<div class="welcome-emoji">'+s.emoji+'</div>'
    + '<div class="welcome-titolo">'+escapeHtml(s.titolo)+'</div>'
    + '<p class="welcome-testo">'+escapeHtml(s.testo)+'</p>';
  var dots = "";
  WELCOME_SLIDES.forEach(function(_, i){ dots += '<span class="welcome-dot'+(i===_welcomeIdx?" attivo":"")+'"></span>'; });
  document.getElementById("welcome-dots").innerHTML = dots;
  var ultima = (_welcomeIdx === WELCOME_SLIDES.length - 1);
  document.getElementById("welcome-avanti").textContent = ultima ? "Iniziamo! 🎉" : "Avanti";
  document.getElementById("welcome-indietro").style.visibility = (_welcomeIdx === 0) ? "hidden" : "visible";
}
function welcomeAvanti(){
  if(_welcomeIdx < WELCOME_SLIDES.length - 1){ _welcomeIdx++; renderWelcome(); }
  else { welcomeFine(); }
}
function welcomeIndietro(){ if(_welcomeIdx > 0){ _welcomeIdx--; renderWelcome(); } }
function welcomeFine(){
  try{ localStorage.setItem(WELCOME_KEY, "1"); }catch(e){}
  var ov = document.getElementById("welcome-overlay");
  if(ov) ov.classList.remove("attivo");
}
// swipe touch leggero (solo avanzamento/indietro fra slide)
var _wTouchX = null;
function _welcomeTouchStart(e){ _wTouchX = e.changedTouches[0].clientX; }
function _welcomeTouchEnd(e){
  if(_wTouchX === null) return;
  var dx = e.changedTouches[0].clientX - _wTouchX; _wTouchX = null;
  if(dx < -40 && _welcomeIdx < WELCOME_SLIDES.length - 1) welcomeAvanti();
  else if(dx > 40) welcomeIndietro();
}

// FAQ toggle: stessa animazione dell'accordion ma conserva il testo della domanda
function faqToggle(boxId, btnId){
  var box = document.getElementById(boxId); if(!box) return;
  var btn = document.getElementById(btnId);
  var apri = box.getAttribute("data-open") !== "1";
  if(apri){
    box.style.maxHeight = box.scrollHeight + "px";
    box.setAttribute("data-open","1");
    setTimeout(function(){ if(box.getAttribute("data-open")==="1") box.style.maxHeight="none"; }, 360);
  } else {
    box.style.maxHeight = box.scrollHeight + "px";
    void box.offsetHeight;
    requestAnimationFrame(function(){ box.style.maxHeight = "0px"; });
    box.setAttribute("data-open","0");
  }
  if(btn){ var t = btn.textContent.replace(/^[▸▾]\s*/,""); btn.textContent = (apri?"▾ ":"▸ ")+t; }
}
