// ════════════════════════════════════════════════════════
//  sPiccioli! — grafici.js
//  Overlay Grafici: chi ha speso / per categoria / storico (coppia).
//  Self-contained: globali S.movimenti, chiusureCassa, membriCorrente,
//  cassaCorrente + nomiMembri (cassa.js), importoCon/escapeHtml (utils.js).
//  Emoji-only, palette fissa (il design lo rifà Claude Design più avanti).
// ════════════════════════════════════════════════════════

var _graficoVista = "chi";   // "chi" | "categoria" | "storico"
// Lotto 9: palette derivata dai token del tema (non più fissa) — leggibile su chiaro e scuro
function _hexToHsl(hex){
  var h = (hex||"#4DD0FF").replace("#","");
  if(h.length===3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  var r=parseInt(h.substr(0,2),16)/255, g=parseInt(h.substr(2,2),16)/255, b=parseInt(h.substr(4,2),16)/255;
  var max=Math.max(r,g,b), min=Math.min(r,g,b), hh=0, ss=0, ll=(max+min)/2;
  if(max!==min){
    var d=max-min; ss = ll>0.5 ? d/(2-max-min) : d/(max+min);
    if(max===r) hh=(g-b)/d+(g<b?6:0); else if(max===g) hh=(b-r)/d+2; else hh=(r-g)/d+4;
    hh*=60;
  }
  return { h:hh, s:ss*100, l:ll*100 };
}
function _hslToHex(h,s,l){
  h=((h%360)+360)%360; s=Math.max(0,Math.min(100,s))/100; l=Math.max(0,Math.min(100,l))/100;
  var c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2, r=0,g=0,b=0;
  if(h<60){r=c;g=x;b=0;} else if(h<120){r=x;g=c;b=0;} else if(h<180){r=0;g=c;b=x;}
  else if(h<240){r=0;g=x;b=c;} else if(h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
  function to255(v){ return Math.round((v+m)*255); }
  function toHex(v){ var s2=v.toString(16); return s2.length===1?"0"+s2:s2; }
  return "#"+toHex(to255(r))+toHex(to255(g))+toHex(to255(b));
}
function _graficoPalette(n){
  var css = getComputedStyle(document.body);
  var a1 = (css.getPropertyValue("--th-accent")||"").trim() || "#4DD0FF";
  var a2 = (css.getPropertyValue("--th-accent2")||"").trim() || "#FFC24D";
  var a3 = (css.getPropertyValue("--th-accent-dark")||"").trim() || a1;
  var anchors = [a1, a2, a3], out = [], base = _hexToHsl(a1);
  for(var i=0;i<n;i++){
    if(i < anchors.length){ out.push(anchors[i]); continue; }
    var hue = (base.h + i*137.508) % 360;
    var sBand = Math.max(45, Math.min(72, base.s));
    var lBand = (i % 2 === 0) ? 46 : 58;
    out.push(_hslToHex(hue, sBand, lBand));
  }
  return out;
}

function _baseCur(){ return (cassaCorrente && cassaCorrente.valuta_base) || "EUR"; }
function _movValide(){
  return (S.movimenti || []).filter(function(m){ return m.tipo !== "settle" && m.origine !== "apertura"; });
}

function apriGrafici(){
  _graficoVista = "chi";
  var ov = document.getElementById("modal-grafico");
  if(!ov) return;
  ov.classList.add("attivo");
  _renderGrafico();
}
function chiudiGrafici(){ var ov=document.getElementById("modal-grafico"); if(ov) ov.classList.remove("attivo"); }
function setGraficoVista(v){ _graficoVista = v; _renderGrafico(); }

function _renderGrafico(){
  var isCoppia = cassaCorrente && cassaCorrente.tipo === "coppia";
  if(_graficoVista === "storico" && !isCoppia) _graficoVista = "chi";
  var tg = document.getElementById("grafico-tabs");
  if(tg){
    var t = "";
    t += '<button class="gr-tab'+(_graficoVista==="chi"?" attivo":"")+'" onclick="setGraficoVista(\'chi\')">👥 Membri</button>';
    t += '<button class="gr-tab'+(_graficoVista==="categoria"?" attivo":"")+'" onclick="setGraficoVista(\'categoria\')">🏷️ Categorie</button>';
    if(isCoppia) t += '<button class="gr-tab'+(_graficoVista==="storico"?" attivo":"")+'" onclick="setGraficoVista(\'storico\')">📊 Storico</button>';
    tg.innerHTML = t;
  }
  var body = document.getElementById("grafico-body");
  if(!body) return;
  if(_graficoVista === "storico" && isCoppia){ _renderStorico(body); }
  else if(_graficoVista === "categoria"){ _renderDonut(body, _datiCategoria()); }
  else { _renderDonut(body, _datiChi()); }
}

// ── aggregazioni ──
function _datiChi(){
  var per = {}, nomi = nomiMembri();
  _movValide().forEach(function(m){
    var t = parseFloat(m.tasso_cambio) || 1;
    (m.paganti || []).forEach(function(p){
      per[p.membro_id] = (per[p.membro_id] || 0) + (parseFloat(p.importo)||0) * t;
    });
  });
  return Object.keys(per).filter(function(k){ return per[k] > 0.005; })
    .map(function(k){ return { label: nomi[k] || "?", val: per[k] }; })
    .sort(function(a,b){ return b.val - a.val; });
}
function _datiCategoria(){
  var per = {};
  _movValide().forEach(function(m){
    var v = (parseFloat(m.importo)||0) * (parseFloat(m.tasso_cambio)||1);
    if(v <= 0) return;
    var c = (m.categoria && m.categoria.trim()) ? m.categoria.trim() : "Senza categoria";
    per[c] = (per[c] || 0) + v;
  });
  return Object.keys(per).map(function(c){ return { label:c, val:per[c] }; })
    .sort(function(a,b){ return b.val - a.val; });
}

// ── donut generico ──
function _renderDonut(body, dati){
  var tot = dati.reduce(function(a,d){ return a+d.val; }, 0);
  if(!dati.length || tot <= 0){ body.innerHTML = '<div class="grafico-vuoto">Nessuna spesa in questo periodo.</div>'; return; }
  body.innerHTML = '<div class="grafico-donut-wrap"><canvas id="grafico-canvas"></canvas></div><div id="grafico-legenda" class="grafico-legenda"></div>';
  var lh = "";
  var _pal = _graficoPalette(dati.length);
  dati.forEach(function(d, i){
    d.color = _pal[i];
    var perc = Math.round(d.val/tot*100);
    lh += '<div class="gr-leg-item"><span class="gr-leg-dot" style="background:'+d.color+'"></span>'
        + '<span class="gr-leg-nome">'+escapeHtml(d.label)+'</span>'
        + '<span class="gr-leg-val">'+importoCon(d.val, _baseCur())+' · '+perc+'%</span></div>';
  });
  lh += '<div class="gr-leg-item gr-leg-tot"><span class="gr-leg-nome">Totale</span><span class="gr-leg-val">'+importoCon(tot, _baseCur())+'</span></div>';
  document.getElementById("grafico-legenda").innerHTML = lh;
  setTimeout(function(){ _drawDonut(document.getElementById("grafico-canvas"), dati, tot); }, 30);
}
function _drawDonut(canvas, slices, tot){
  if(!canvas) return;
  var ctx = canvas.getContext("2d");
  var dpr = window.devicePixelRatio || 1;
  var size = Math.min(200, (canvas.parentElement.offsetWidth || 220) - 16);
  canvas.width = size*dpr; canvas.height = size*dpr;
  canvas.style.width = size+"px"; canvas.style.height = size+"px";
  ctx.scale(dpr, dpr);
  var cx=size/2, cy=size/2, r=size/2-4, ang=-Math.PI/2;
  var css = getComputedStyle(document.documentElement);
  var cardBg = (css.getPropertyValue("--br-card")||"#fff").trim();
  slices.forEach(function(s){
    if(!s.val) return;
    var fetta = (s.val/tot)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,ang,ang+fetta); ctx.closePath();
    ctx.fillStyle = s.color; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = cardBg; ctx.stroke();
    ang += fetta;
  });
  ctx.beginPath(); ctx.arc(cx,cy,r*0.56,0,Math.PI*2);
  ctx.fillStyle = cardBg;
  ctx.fill();
}

// ── storico (coppia): barre per chiusura + corrente ──
function _renderStorico(body){
  var chiusure = [].concat(chiusureCassa || []).reverse(); // da seq desc → asc
  var dati = chiusure.map(function(c){ return { label: c.nome || _meseLabel(c.mese || c.chiusa_il), val: parseFloat(c.totale_speso)||0 }; });
  var totCorr = _movValide().reduce(function(a,m){ return a + (parseFloat(m.importo)||0)*(parseFloat(m.tasso_cambio)||1); }, 0);
  dati.push({ label: "Corrente", val: Math.round(totCorr*100)/100 });
  if(!dati.some(function(d){ return d.val > 0; })){ body.innerHTML = '<div class="grafico-vuoto">Chiudi almeno un mese per lo storico.</div>'; return; }
  body.innerHTML = '<div class="grafico-barre-wrap"><canvas id="grafico-canvas"></canvas></div>';
  setTimeout(function(){ _drawBarre(document.getElementById("grafico-canvas"), dati); }, 30);
}
function _meseLabel(iso){
  if(!iso) return "?";
  return new Date(iso).toLocaleDateString("it-IT", { month:"short", year:"2-digit" });
}
function _drawBarre(canvas, dati){
  if(!canvas) return;
  var ctx = canvas.getContext("2d");
  var dpr = window.devicePixelRatio || 1;
  var W = (canvas.parentElement.offsetWidth || 300), H = 220;
  canvas.width = W*dpr; canvas.height = H*dpr;
  canvas.style.width = W+"px"; canvas.style.height = H+"px";
  ctx.scale(dpr, dpr);
  var css = getComputedStyle(document.documentElement);
  var accent = (css.getPropertyValue("--th-accent")||"#E8833A").trim();
  var dim = (css.getPropertyValue("--br-dim")||"#999").trim();
  var max = Math.max.apply(null, dati.map(function(d){ return d.val; }).concat([1]));
  var padB = 34, padT = 12, padX = 8, gap = 8, n = dati.length;
  var bw = Math.max(10, (W - padX*2 - gap*(n-1)) / n);
  ctx.font = "10px 'Nunito',sans-serif"; ctx.textAlign = "center";
  dati.forEach(function(d, i){
    var x = padX + i*(bw+gap);
    var bh = (H - padB - padT) * (d.val/max);
    var y = H - padB - bh;
    if(bh > 0){ ctx.fillStyle = (i===n-1) ? dim : accent; _roundRect(ctx, x, y, bw, bh, 5); ctx.fill(); }
    ctx.fillStyle = dim; ctx.fillText(d.label, x+bw/2, H-padB+14);
  });
}
function _roundRect(ctx,x,y,w,h,r){
  r = Math.min(r, w/2, h);
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

// ── Report finale gruppo terminato (riusa le aggregazioni sopra) ──
function renderReportGruppo(){
  var slot = document.getElementById("report-gruppo");
  if(!slot) return;
  if(!cassaCorrente || cassaCorrente.tipo !== "gruppo" || cassaCorrente.stato !== "terminata"){ slot.innerHTML = ""; return; }

  var movs = _movValide();
  var nMov = movs.length;
  var tot  = movs.reduce(function(a,m){ return a + (parseFloat(m.importo)||0)*(parseFloat(m.tasso_cambio)||1); }, 0);
  var cat  = _datiCategoria();
  var topCat = cat.length ? cat[0] : null;
  var saldi = calcolaSaldi();
  var nomi  = nomiMembri();

  var h = '<div class="card report-finale">';
  h += '<div class="card-titolo">🏁 Riepilogo finale</div>';
  h += '<p class="report-sub">Sipario! Il gruppo è terminato: applausi, abbracci e conti in chiaro.</p>';
  h += '<div class="report-metriche">';
  h += '<div class="report-metrica"><span class="rm-val">'+eur(tot)+'</span><span class="rm-lab">speso in totale</span></div>';
  h += '<div class="report-metrica"><span class="rm-val">'+nMov+'</span><span class="rm-lab">'+(nMov===1?'movimento':'movimenti')+'</span></div>';
  if(topCat) h += '<div class="report-metrica"><span class="rm-val">'+escapeHtml(topCat.label)+'</span><span class="rm-lab">categoria top</span></div>';
  h += '</div>';
  h += '<div class="report-sez-tit">Saldo finale</div>';
  membriCorrente.forEach(function(m){
    var s = saldi[m.id] || 0;
    var badge = Math.abs(s) < 0.005 ? '<span class="mb-pari">in pari</span>'
      : (s > 0 ? '<span class="mb-cred">+'+eur(s)+'</span>' : '<span class="mb-deb">−'+eur(Math.abs(s))+'</span>');
    h += '<div class="report-saldo-row"><span>'+escapeHtml(nomi[m.id]||"?")+'</span>'+badge+'</div>';
  });
  h += '<p class="report-sub" style="margin-top:10px;">È stato un bel viaggio. Il maialino ringrazia. 🐷</p>';
  h += '<button class="btn-ghost btn-mini" style="margin-top:12px;" onclick="apriGrafici()">📊 Vedi i grafici</button>';
  h += '</div>';
  slot.innerHTML = h;
}
