// ════════════════════════════════════════════════════════
//  sPiccioli! — auth.js
//  Guscio: registrazione/login, scelta cassa, crea/unisci.
// ════════════════════════════════════════════════════════

async function authInit(){
  var res = await sb.auth.getSession();
  if(res.data && res.data.session){
    await caricaProfilo();
    vaiAlleCasse();
  } else {
    mostraSchermata("auth-screen");
    setTimeout(function(){ var e=document.getElementById("auth-email"); if(e) e.focus(); }, 200);
  }
}

// ── AUTENTICAZIONE ──
var modoRegistrazione = false;
function toggleModoAuth(){
  modoRegistrazione = !modoRegistrazione;
  document.getElementById("auth-nome-wrap").style.display = modoRegistrazione ? "block" : "none";
  document.getElementById("auth-titolo").textContent   = modoRegistrazione ? "Crea il tuo account" : "Bentornato!";
  document.getElementById("auth-btn").textContent      = modoRegistrazione ? "Registrati" : "Entra";
  document.getElementById("auth-toggle-txt").innerHTML = modoRegistrazione
    ? "Hai già un account? <a onclick=\"toggleModoAuth()\">Accedi</a>"
    : "Non hai un account? <a onclick=\"toggleModoAuth()\">Registrati</a>";
  authErrore("");
}
function authErrore(msg){ document.getElementById("auth-error").textContent = msg || ""; }
function authPwToggle(){ var i=document.getElementById("auth-pw"); i.type = i.type==="password" ? "text" : "password"; }

async function doAuth(){
  var email = document.getElementById("auth-email").value.trim();
  var pw    = document.getElementById("auth-pw").value;
  var nome  = (document.getElementById("auth-nome").value || "").trim();
  if(!email || !pw){ authErrore("Inserisci email e password."); return; }
  if(modoRegistrazione && !nome){ authErrore("Scegli un nome."); return; }

  var btn = document.getElementById("auth-btn");
  btn.disabled = true; authErrore("");
  document.getElementById("auth-loading").textContent = "Un attimo...";

  var res;
  if(modoRegistrazione){
    res = await sb.auth.signUp({ email: email, password: pw, options:{ data:{ nome: nome } } });
  } else {
    res = await sb.auth.signInWithPassword({ email: email, password: pw });
  }

  document.getElementById("auth-loading").textContent = "";
  btn.disabled = false;
  if(res.error){ authErrore(traduciErroreAuth(res.error.message)); return; }

  if(modoRegistrazione && !res.data.session){
    authErrore("Account creato! Conferma l'email, poi accedi.");
    modoRegistrazione = true; toggleModoAuth();
    return;
  }
  await caricaProfilo();
  vaiAlleCasse();
}
function traduciErroreAuth(m){
  m = (m||"").toLowerCase();
  if(m.indexOf("invalid login")>-1 || m.indexOf("credentials")>-1) return "Email o password errati.";
  if(m.indexOf("already registered")>-1 || m.indexOf("already been")>-1) return "Email già registrata. Prova ad accedere.";
  if(m.indexOf("password")>-1 && m.indexOf("least")>-1) return "Password troppo corta (min. 6 caratteri).";
  if(m.indexOf("security purposes")>-1 || m.indexOf("once every")>-1) return "Hai appena fatto una richiesta: aspetta un minuto e riprova.";
  if(m.indexOf("fetch")>-1 || m.indexOf("network")>-1) return "Errore di rete. Riprova.";
  return "Errore: " + m;
}

// ── RECUPERO PASSWORD ──
async function apriResetPw(){
  var email = await promptBrand({
    titolo: "Recupera password",
    testo: "Ti mando un'email con il link per sceglierne una nuova.",
    placeholder: "La tua email",
    valore: document.getElementById("auth-email").value.trim(),
    cta: "📮 Invia"
  });
  if(email === null) return;
  email = (email || "").trim();
  if(!email || email.indexOf("@") < 0){ await alertBrand("Inserisci un'email valida."); return; }
  var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if(r.error){ await alertBrand(traduciErroreAuth(r.error.message)); return; }
  await alertBrand("Fatto! Controlla la posta: se l'email è registrata trovi il link per la nuova password.\nOcchio anche allo spam.");
}
// Al rientro dal link dell'email supabase-js emette PASSWORD_RECOVERY.
sb.auth.onAuthStateChange(function(event){
  if(event === "PASSWORD_RECOVERY") _gestisciRecovery();
});
async function _gestisciRecovery(){
  var pw = await promptBrand({
    titolo: "Scegli la nuova password",
    testo: "Minimo 6 caratteri.",
    placeholder: "Nuova password", tipo: "password", cta: "Salva"
  });
  if(pw === null) return;
  if(pw.length < 6){ await alertBrand("Password troppo corta (min. 6 caratteri)."); return _gestisciRecovery(); }
  var r = await sb.auth.updateUser({ password: pw });
  if(r.error){ await alertBrand(traduciErroreAuth(r.error.message)); return _gestisciRecovery(); }
  await alertBrand("Password aggiornata! 🎉 D'ora in poi entri con quella nuova.");
}
async function logout(){
  // la coda offline non deve sopravvivere al cambio utente (privacy su dispositivi condivisi)
  var nCoda = getCoda().length;
  if(nCoda){
    var ok = await confermaBrand({
      titolo: "Uscire adesso?",
      testo: "Hai " + nCoda + (nCoda===1 ? " operazione salvata offline" : " operazioni salvate offline")
        + " non ancora sincronizzate: se esci ora vanno perse.",
      cta: "Esci comunque", danger: true
    });
    if(!ok) return;
  }
  setCoda([]);
  sb.auth.signOut().then(function(){ location.reload(); });
}

// ── TEMA UTENTE (picker in home: vale per Home + Solo) ──
function apriTemaUtente(){
  var wrap = document.getElementById("tema-utente-body");
  if(wrap) wrap.innerHTML = THEMES.map(function(t){
    return '<button class="split-btn '+((profiloUtente&&profiloUtente.tema)===t.k?"attivo":"")+'" onclick="cambiaTemaUtente(\''+t.k+'\')">'+t.e+' '+t.n+'</button>';
  }).join("");
  document.getElementById("modal-tema-utente").classList.add("attivo");
}
function chiudiTemaUtente(){ document.getElementById("modal-tema-utente").classList.remove("attivo"); }
async function cambiaTemaUtente(t){
  if(!profiloUtente || t === profiloUtente.tema) return;
  var r = await sb.from("profili").update({ tema: t }).eq("id", profiloUtente.id);
  if(r.error){ await alertBrand(msgErrore(r.error)); return; }
  profiloUtente.tema = t;
  document.body.setAttribute("data-tema", t);   // siamo su home → applica subito
  aggiornaThemeColor();
  apriTemaUtente();                              // rinfresca evidenziazione
}

// ── ACCOUNT (👤 in home): nome, password, luminosità, elimina account ──
function apriAccount(){
  var i = document.getElementById("account-nome");
  if(i) i.value = (profiloUtente && profiloUtente.nome) || "";
  var p = document.getElementById("account-pw"); if(p) p.value = "";
  renderAccountLum();
  document.getElementById("modal-account").classList.add("attivo");
  setTimeout(function(){ if(i) i.focus(); }, 100);
}
function chiudiAccount(){ document.getElementById("modal-account").classList.remove("attivo"); }
function renderAccountLum(){
  var el = document.getElementById("account-lum");
  if(el && typeof _lumSeg === "function") el.innerHTML = _lumSeg();
}
async function salvaNomeAccount(){
  var nome = ((document.getElementById("account-nome") || {}).value || "").trim();
  if(!nome){ await alertBrand("Scegli un nome."); return; }
  if(!profiloUtente) return;
  if(nome === profiloUtente.nome){ toastInfo("Nome già a posto 👍"); return; }
  var r = await sb.from("profili").update({ nome: nome }).eq("id", profiloUtente.id);
  if(r.error){ await alertBrand(msgErrore(r.error)); return; }
  profiloUtente.nome = nome;
  var el = document.getElementById("casse-nome-utente");   // aggiorna il saluto in home
  if(el) el.textContent = profiloUtente.nome || profiloUtente.email;
  toastInfo("Nome aggiornato ✅");
}
async function salvaPasswordAccount(){
  var pw = (document.getElementById("account-pw") || {}).value || "";
  if(pw.length < 8){ await alertBrand("Password troppo corta (min. 8 caratteri)."); return; }
  var r = await sb.auth.updateUser({ password: pw });
  if(r.error){ toastInfo(msgErrore(r.error)); return; }
  document.getElementById("account-pw").value = "";
  toastInfo("Password aggiornata 🔒");
}
async function eliminaAccount(){
  var ok = await confermaBrand({
    titolo: "Eliminare l'account?",
    testo: "Nelle casse condivise diventi 👻 e la storia resta. Il tuo Solo e l'accesso spariscono per sempre.",
    cta: "Continua", danger: true
  });
  if(!ok) return;
  var val = await promptBrand({
    titolo: "Sei proprio sicuro?",
    testo: "Scrivi <b>ELIMINA</b> per confermare.",
    placeholder: "ELIMINA", cta: "🗑️ Elimina per sempre"
  });
  if(val === null) return;
  if((val || "").trim() !== "ELIMINA"){ await alertBrand("Non eliminato: devi scrivere esattamente ELIMINA."); return; }
  var r = await sb.rpc("elimina_account");
  if(r.error){ await alertBrand(msgErrore(r.error)); return; }
  chiudiAccount();
  await sb.auth.signOut();
  location.reload();   // torna alla schermata di accesso
}

async function caricaProfilo(){
  var u = (await sb.auth.getUser()).data.user;
  if(!u) return;
  var p = await sb.from("profili").select("nome, tema, lum").eq("id", u.id).maybeSingle();
  var lum = p.data && p.data.lum;
  profiloUtente = {
    id: u.id, email: u.email,
    nome: (p.data && p.data.nome) || "",
    tema: (p.data && p.data.tema) || "salvadanaio",
    lum:  (lum === "chiaro" || lum === "scuro" || lum === "auto") ? lum : "auto"
  };
  // Luminosità dal profilo (sincronizzata tra dispositivi); localStorage è il fallback offline.
  if(lum === "chiaro" || lum === "scuro" || lum === "auto"){
    try{ localStorage.setItem("spiccioli_lum", lum); }catch(e){}
    if(typeof applicaLum === "function") applicaLum();
  }
}

// ── LE TUE CASSE ──
async function vaiAlleCasse(){
  mostraSchermata("casse-screen");
  await caricaCasse();
  maybeWelcome();
}
async function caricaCasse(){
  var lista = document.getElementById("casse-list");
  lista.innerHTML = '<div class="casse-loading">Carico le tue casse...</div>';
  var rc = await sb.from("casse").select("*").order("created_at", { ascending: true });
  if(rc.error){ lista.innerHTML = '<div class="casse-empty">Errore nel caricamento.</div>'; return; }
  CASSE = rc.data || [];
  var rm = await sb.from("membri").select("cassa_id,user_id,ruolo,attivo");
  var membri = rm.data || [];
  CASSE.forEach(function(c){
    var dellaCassa = membri.filter(function(m){ return m.cassa_id === c.id && m.attivo; });
    c.nMembri = dellaCassa.length;
    var mio = dellaCassa.find(function(m){ return m.user_id === profiloUtente.id; });
    c.ruolo = mio ? mio.ruolo : "membro";
  });
  renderCasse();
}
function renderCasse(){
  document.getElementById("casse-nome-utente").textContent = profiloUtente.nome || profiloUtente.email;
  var lista = document.getElementById("casse-list");
  if(!CASSE.length){
    lista.innerHTML = '<div class="casse-empty">Nessuna cassa qui. Creane una o fatti invitare — io non mordo.</div>';
    return;
  }
  lista.innerHTML = CASSE.map(function(c){
    var modo  = c.modalita === "diretti" ? "Debiti diretti" : "Cassa comune";
    var tipo  = c.tipo === "gruppo" ? "Gruppo" : "Coppia";
    var admin = c.ruolo === "admin" ? '<span class="cassa-badge-admin">admin</span>' : '';
    return '<div class="cassa-item" onclick="entraInCassa(\''+c.id+'\')" tabindex="0" role="button">'
      +   '<div class="cassa-emoji">'+emojiTema(c.tema)+'</div>'
      +   '<div class="cassa-info">'
      +     '<div class="cassa-nome">'+escapeHtml(c.nome)+admin+'</div>'
      +     '<div class="cassa-meta">'+tipo+' · '+modo+' · '+c.nMembri+(c.nMembri===1?' membro':' membri')+'</div>'
      +   '</div>'
      +   '<div class="cassa-freccia">›</div>'
      + '</div>';
  }).join("");
}
function emojiTema(t){
  var m = { salvadanaio:"🐷", orsi:"🐻", pesci:"🐟", west:"🤠", alieni:"👽", jungle:"🦜", flamingo:"🦩" };
  return m[t] || "💰";
}

// ── CREA CASSA ──
function openCreaCassa(){
  document.getElementById("modal-crea").classList.add("attivo");
  creaErrore("");
  onCambioTipoCassa();   // stato iniziale (default coppia → riga modalità visibile)
  setTimeout(function(){ document.getElementById("crea-nome").focus(); }, 100);
}
function closeCreaCassa(){ document.getElementById("modal-crea").classList.remove("attivo"); }
function creaErrore(m){ document.getElementById("crea-error").textContent = m || ""; }
function onCambioTipoCassa(){
  var tipo = document.getElementById("crea-tipo").value;
  // il gruppo è sempre a debiti diretti: nascondi la scelta di modalità
  document.getElementById("crea-modalita-row").style.display = (tipo === "coppia") ? "block" : "none";
}
async function confermaCreaCassa(){
  var nome       = document.getElementById("crea-nome").value.trim();
  var tipo       = document.getElementById("crea-tipo").value;
  var modalita   = (tipo === "coppia")
     ? document.getElementById("crea-modalita").value
     : "diretti";
  var tema       = document.getElementById("crea-tema").value;
  var nomeMembro = document.getElementById("crea-nome-membro").value.trim() || profiloUtente.nome;
  if(!nome){ creaErrore("Dai un nome alla cassa."); return; }
  var btn = document.getElementById("crea-btn"); btn.disabled = true; creaErrore("");
  var r = await sb.rpc("crea_cassa", {
    p_nome: nome, p_modalita: modalita, p_valuta: "EUR", p_tema: tema, p_nome_membro: nomeMembro, p_tipo: tipo
  });
  btn.disabled = false;
  if(r.error){ creaErrore(msgErrore(r.error)); return; }
  document.getElementById("crea-nome").value = "";
  document.getElementById("crea-nome-membro").value = "";
  closeCreaCassa();
  await caricaCasse();
}

// ── UNISCITI CON CODICE ──
function openUnisci(){
  document.getElementById("modal-unisci").classList.add("attivo");
  unisciErrore("");
  document.getElementById("unisci-fantasma-check").checked = false;
  toggleUnisciFantasma(false);
  setTimeout(function(){ document.getElementById("unisci-codice").focus(); }, 100);
}
function closeUnisci(){ document.getElementById("modal-unisci").classList.remove("attivo"); }
function unisciErrore(m){ document.getElementById("unisci-error").textContent = m || ""; }
function toggleUnisciFantasma(on){
  document.getElementById("unisci-fantasma-row").style.display = on ? "" : "none";
  if(!on) document.getElementById("unisci-fantasma-nome").value = "";
}
async function confermaUnisci(){
  var codice       = document.getElementById("unisci-codice").value.trim().toUpperCase();
  var nomeMembro   = document.getElementById("unisci-nome-membro").value.trim() || profiloUtente.nome;
  var eraFantasma  = document.getElementById("unisci-fantasma-check").checked;
  var nomeFantasma = document.getElementById("unisci-fantasma-nome").value.trim();
  if(codice.length < 4){ unisciErrore("Inserisci il codice della cassa."); return; }
  if(eraFantasma && !nomeFantasma){ unisciErrore("Inserisci il nome con cui ti hanno aggiunto."); return; }
  var btn = document.getElementById("unisci-btn"); btn.disabled = true; unisciErrore("");

  var fantasmaId = null;
  if(eraFantasma){
    var r1 = await sb.rpc("trova_fantasma", { p_codice: codice, p_nome: nomeFantasma });
    if(r1.error){ btn.disabled = false; toastInfo(msgErrore(r1.error)); return; }
    if(!r1.data){
      btn.disabled = false;
      toastInfo("Nessun 👻 con questo nome in questa cassa. Controlla il nome o togli la spunta per entrare come nuovo.");
      return;
    }
    fantasmaId = r1.data;
  }

  var r = await sb.rpc("unisciti_a_cassa", { p_codice: codice, p_nome_membro: nomeMembro, p_fantasma_id: fantasmaId });
  btn.disabled = false;
  if(r.error){ unisciErrore(traduciErroreUnisci(r.error.message)); return; }
  document.getElementById("unisci-codice").value = "";
  document.getElementById("unisci-fantasma-check").checked = false;
  toggleUnisciFantasma(false);
  closeUnisci();
  await caricaCasse();
  if(eraFantasma) toastInfo("Bentornato! Da 👻 a 👤: spese e saldi sono già tuoi.");
}
function traduciErroreUnisci(m){
  m = (m||"").toLowerCase();
  if(m.indexOf("non valido")>-1)      return "Codice non valido.";
  if(m.indexOf("non disponibile")>-1) return "Quel posto non è disponibile.";
  return "Errore: " + m;
}

// ── ENTRA / ESCI DALLA CASSA ──
function entraInCassa(id){ apriCassa(id); }        // apriCassa vive in api.js
function tornaAlleCasse(){
  chiudiRealtimeCassa();
  if(typeof chiudiRealtimeScherzi === "function") chiudiRealtimeScherzi();
  if(typeof _scherziCassaId !== "undefined") _scherziCassaId = null;
  cassaCorrente = null;
  membriCorrente = [];
  S.movimenti = [];
  vaiAlleCasse();
}

// ── PRESENTAZIONE ("Cos'è sPiccioli!") ──
// Overlay riusabile: per ora dal login, in futuro slide (S10) e crawl Silly (S8).
function apriInfo(){ document.getElementById("info-overlay").classList.add("attivo"); }
function chiudiInfo(){ document.getElementById("info-overlay").classList.remove("attivo"); }

// ── S8d: crawl easter egg ──
function apriCrawl(){
  var ov = document.getElementById("crawl-overlay");
  if(!ov) return;
  ov.classList.add("attivo");
  // restart pulito delle animazioni (intro + testo) a ogni apertura
  ["crawl-intro","crawl-text"].forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.style.animation = "none";
    void el.offsetHeight;        // forza reflow
    el.style.animation = "";     // riparte dalla regola CSS
  });
}
function chiudiCrawl(){
  var ov = document.getElementById("crawl-overlay");
  if(ov) ov.classList.remove("attivo");
}
