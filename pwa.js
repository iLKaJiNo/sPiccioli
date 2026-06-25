// ════════════════════════════════════════════════════════
//  sPiccioli! — pwa.js
//  Install PWA: deferredPrompt, bottone, eventi. Concern a sé,
//  fuori dal core (utils.js). Globale, registrato a parse-time.
// ════════════════════════════════════════════════════════

// ── PWA BANNER ──
var deferredPrompt = null;
function _installBtnVisibile(mostra){
  var b = document.getElementById("btn-install");
  if(b) b.style.display = mostra ? "block" : "none";
}
window.addEventListener("beforeinstallprompt", function(e){
  e.preventDefault();
  deferredPrompt = e;
  _installBtnVisibile(true);
});
window.addEventListener("appinstalled", function(){
  deferredPrompt = null;
  _installBtnVisibile(false);
});
function installApp(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function(){
    deferredPrompt = null;
    _installBtnVisibile(false);
  });
}
