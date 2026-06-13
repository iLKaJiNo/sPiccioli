// ════════════════════════════════════════════════════════
//  sPiccioli! — auth.js
//  Il "guscio" attorno all'app: registrazione/login, scelta
//  della cassa, creazione e ingresso con codice.
//  In S2 entrare in una cassa mostra un PLACEHOLDER: i tab veri
//  (movimenti) si costruiscono in S3 sul nuovo schema.
// ════════════════════════════════════════════════════════

// ── BOOT ──
// Chiamato da app.js. Se c'è già una sessione valida salta il login.
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

// ════════════════════════════════════════════════════════
//  AUTENTICAZIONE
// ════════════════════════════════════════════════════════

// La stessa schermata fa login E registrazione: questo flag decide quale.
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
    // Il "nome" finisce nei metadati: il trigger crea_profilo() lo copia in profili.nome
    res = await sb.auth.signUp({ email: email, password: pw, options:{ data:{ nome: nome } } });
  } else {
    res = await sb.auth.signInWithPassword({ email: email, password: pw });
  }

  document.getElementById("auth-loading").textContent = "";
  btn.disabled = false;

  if(res.error){ authErrore(traduciErroreAuth(res.error.message)); return; }

  // Se la conferma email è ATTIVA, dopo signUp non c'è sessione: invito ad accedere.
  if(modoRegistrazione && !res.data.session){
    authErrore("Account creato! Conferma l'email, poi accedi.");
    modoRegistrazione = true; toggleModoAuth(); // torna a modo login
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
  if(m.indexOf("fetch")>-1 || m.indexOf("network")>-1) return "Errore di rete. Riprova.";
  return "Errore: " + m;
}

function logout(){ sb.auth.signOut().then(function(){ location.reload(); }); }

// ── PROFILO ──
async function caricaProfilo(){
  var u = (await sb.auth.getUser()).data.user;
  if(!u) return;
  var p = await sb.from("profili").select("nome").eq("id", u.id).maybeSingle();
  profiloUtente = { id: u.id, email: u.email, nome: (p.data && p.data.nome) || "" };
}

// ════════════════════════════════════════════════════════
//  LE TUE CASSE
// ════════════════════════════════════════════════════════

async function vaiAlleCasse(){
  mostraSchermata("casse-screen");
  await caricaCasse();
}

async function caricaCasse(){
  var lista = document.getElementById("casse-list");
  lista.innerHTML = '<div class="casse-loading">Carico le tue casse...</div>';

  // Grazie alla RLS, questa query torna SOLO le casse di cui sono membro.
  var rc = await sb.from("casse").select("*").order("created_at", { ascending: true });
  if(rc.error){ lista.innerHTML = '<div class="casse-empty">Errore nel caricamento.</div>'; return; }
  CASSE = rc.data || [];

  // Membri delle mie casse: mi servono per il conteggio e per sapere se sono admin.
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
    lista.innerHTML = '<div class="casse-empty">Non sei ancora in nessuna cassa.<br>Creane una o unisciti con un codice! 👇</div>';
    return;
  }

  lista.innerHTML = CASSE.map(function(c){
    var modo  = c.modalita === "diretti" ? "Debiti diretti" : "Cassa comune";
    var admin = c.ruolo === "admin" ? '<span class="cassa-badge-admin">admin</span>' : '';
    return '<div class="cassa-item" onclick="entraInCassa(\''+c.id+'\')">'
      +   '<div class="cassa-emoji">'+emojiTema(c.tema)+'</div>'
      +   '<div class="cassa-info">'
      +     '<div class="cassa-nome">'+escapeHtml(c.nome)+admin+'</div>'
      +     '<div class="cassa-meta">'+modo+' · '+c.nMembri+(c.nMembri===1?' membro':' membri')+'</div>'
      +   '</div>'
      +   '<div class="cassa-freccia">›</div>'
      + '</div>';
  }).join("");
}

// Emoji-segnaposto per tema (i temi veri arrivano in S8).
function emojiTema(t){
  var m = { orsi:"🐻", pesci:"🐟", west:"🤠", alieni:"👽", jungle:"🦜", flamingo:"🦩" };
  return m[t] || "💰";
}

// ════════════════════════════════════════════════════════
//  CREA CASSA
// ════════════════════════════════════════════════════════

function openCreaCassa(){
  document.getElementById("modal-crea").classList.add("attivo");
  creaErrore("");
  setTimeout(function(){ document.getElementById("crea-nome").focus(); }, 100);
}
function closeCreaCassa(){ document.getElementById("modal-crea").classList.remove("attivo"); }
function creaErrore(m){ document.getElementById("crea-error").textContent = m || ""; }

async function confermaCreaCassa(){
  var nome       = document.getElementById("crea-nome").value.trim();
  var modalita   = document.getElementById("crea-modalita").value;
  var tema       = document.getElementById("crea-tema").value;
  var nomeMembro = document.getElementById("crea-nome-membro").value.trim() || profiloUtente.nome;
  if(!nome){ creaErrore("Dai un nome alla cassa."); return; }

  var btn = document.getElementById("crea-btn");
  btn.disabled = true; creaErrore("");

  // crea_cassa() crea la cassa, genera il codice e mi iscrive come admin (atomico).
  var r = await sb.rpc("crea_cassa", {
    p_nome: nome, p_modalita: modalita, p_valuta: "EUR",
    p_tema: tema, p_nome_membro: nomeMembro
  });
  btn.disabled = false;

  if(r.error){ creaErrore("Errore: " + r.error.message); return; }
  document.getElementById("crea-nome").value = "";
  document.getElementById("crea-nome-membro").value = "";
  closeCreaCassa();
  await caricaCasse();
}

// ════════════════════════════════════════════════════════
//  UNISCITI CON CODICE
// ════════════════════════════════════════════════════════

function openUnisci(){
  document.getElementById("modal-unisci").classList.add("attivo");
  unisciErrore("");
  setTimeout(function(){ document.getElementById("unisci-codice").focus(); }, 100);
}
function closeUnisci(){ document.getElementById("modal-unisci").classList.remove("attivo"); }
function unisciErrore(m){ document.getElementById("unisci-error").textContent = m || ""; }

async function confermaUnisci(){
  var codice     = document.getElementById("unisci-codice").value.trim().toUpperCase();
  var nomeMembro = document.getElementById("unisci-nome-membro").value.trim() || profiloUtente.nome;
  if(codice.length < 4){ unisciErrore("Inserisci il codice della cassa."); return; }

  var btn = document.getElementById("unisci-btn");
  btn.disabled = true; unisciErrore("");

  var r = await sb.rpc("unisciti_a_cassa", {
    p_codice: codice, p_nome_membro: nomeMembro, p_fantasma_id: null
  });
  btn.disabled = false;

  if(r.error){ unisciErrore(traduciErroreUnisci(r.error.message)); return; }
  document.getElementById("unisci-codice").value = "";
  closeUnisci();
  await caricaCasse();
}

function traduciErroreUnisci(m){
  m = (m||"").toLowerCase();
  if(m.indexOf("non valido")>-1)       return "Codice non valido.";
  if(m.indexOf("non disponibile")>-1)  return "Quel posto non è disponibile.";
  return "Errore: " + m;
}

// ════════════════════════════════════════════════════════
//  ENTRA IN CASSA  —  S2: solo placeholder
// ════════════════════════════════════════════════════════

function entraInCassa(id){ apriCassa(id); }   // apriCassa vive in api.js

function tornaAlleCasse(){
  chiudiRealtimeCassa();
  cassaCorrente = null;
  membriCorrente = [];
  S.movimenti = [];
  vaiAlleCasse();
}
