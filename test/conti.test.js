// ════════════════════════════════════════════════════════
//  sPiccioli! — test/conti.test.js
//  Unit test del motore dei conti (funzioni pure di utils.js).
//  Zero dipendenze:  node test/conti.test.js
// ════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// stub minimi per caricare utils.js fuori dal browser
global.supabase = { createClient: function(){ return {}; } };
global.document = { addEventListener: function(){} };

eval(fs.readFileSync(path.join(__dirname, '..', 'utils.js'), 'utf8'));

var passati = 0, falliti = 0;
function test(nome, fn){
  try{ fn(); passati++; console.log('  ✓ ' + nome); }
  catch(e){ falliti++; console.error('  ✗ ' + nome + '\n    ' + (e.message || e)); }
}
function cent(v){ return Math.round(v * 100); }

// ── dividiEquo ──
console.log('\ndividiEquo');
test('10 € in 3: il centesimo di resto va al primo', function(){
  assert.deepStrictEqual(dividiEquo(10, 3), [3.34, 3.33, 3.33]);
});
test('0,02 € in 3: nessun centesimo inventato', function(){
  assert.deepStrictEqual(dividiEquo(0.02, 3), [0.01, 0.01, 0]);
});
test('fuzz: somma sempre esatta, quote mai più distanti di 1 centesimo', function(){
  for(var i = 0; i < 500; i++){
    var imp = Math.round(Math.random() * 100000) / 100;
    var n = 1 + Math.floor(Math.random() * 19);
    var q = dividiEquo(imp, n);
    assert.strictEqual(q.reduce(function(a,b){ return a + cent(b); }, 0), cent(imp));
    assert.ok(Math.max.apply(null, q) - Math.min.apply(null, q) <= 0.01 + 1e-9);
  }
});

// ── ripartisciCentesimi (resto maggiore) ──
console.log('\nripartisciCentesimi');
test('pesi uguali: 1000 cent in 3 → 334/333/333', function(){
  assert.deepStrictEqual(ripartisciCentesimi(1000, [1, 1, 1]), [334, 333, 333]);
});
test('percentuali: 50/30/20 su 10 €', function(){
  assert.deepStrictEqual(ripartisciCentesimi(1000, [50, 30, 20]), [500, 300, 200]);
});
test('pesi tutti zero → tutte quote zero', function(){
  assert.deepStrictEqual(ripartisciCentesimi(1000, [0, 0]), [0, 0]);
});
test('peso zero = escluso dalla divisione', function(){
  assert.deepStrictEqual(ripartisciCentesimi(999, [1, 0, 1]), [500, 0, 499]);
});
test('fuzz: somma invariante, mai quote negative', function(){
  for(var i = 0; i < 500; i++){
    var tot = Math.floor(Math.random() * 100000);
    var n = 1 + Math.floor(Math.random() * 9);
    var pesi = [];
    for(var j = 0; j < n; j++) pesi.push(Math.floor(Math.random() * 10));
    pesi[Math.floor(Math.random() * n)] += 1;   // almeno un peso positivo
    var q = ripartisciCentesimi(tot, pesi);
    assert.strictEqual(q.reduce(function(a,b){ return a + b; }, 0), tot);
    q.forEach(function(v){ assert.ok(v >= 0 && v === Math.floor(v)); });
  }
});

// ── calcolaSaldi ──
console.log('\ncalcolaSaldi');
test('spesa semplice: chi paga va in credito', function(){
  membriCorrente = [{ id: 'a' }, { id: 'b' }];
  S.movimenti = [
    { tasso_cambio: 1, paganti: [{ membro_id: 'a', importo: 20 }],
      quote: [{ membro_id: 'a', importo: 10 }, { membro_id: 'b', importo: 10 }] }
  ];
  var s = calcolaSaldi();
  assert.strictEqual(s.a, 10);
  assert.strictEqual(s.b, -10);
});
test('multivaluta: il tasso congelato pesa paganti e quote', function(){
  membriCorrente = [{ id: 'a' }, { id: 'b' }];
  S.movimenti = [
    { tasso_cambio: 1, paganti: [{ membro_id: 'a', importo: 30 }],
      quote: [{ membro_id: 'a', importo: 15 }, { membro_id: 'b', importo: 15 }] },
    { tasso_cambio: 2, paganti: [{ membro_id: 'b', importo: 10 }],
      quote: [{ membro_id: 'a', importo: 5 }, { membro_id: 'b', importo: 5 }] }
  ];
  var s = calcolaSaldi();
  assert.strictEqual(s.a, 5);    // +30 −15 −10
  assert.strictEqual(s.b, -5);   // −15 +20 −10
});
test('il rimborso (settle) chiude il debito', function(){
  membriCorrente = [{ id: 'a' }, { id: 'b' }];
  S.movimenti = [
    { tasso_cambio: 1, paganti: [{ membro_id: 'a', importo: 20 }],
      quote: [{ membro_id: 'a', importo: 10 }, { membro_id: 'b', importo: 10 }] },
    { tipo: 'settle', tasso_cambio: 1, paganti: [{ membro_id: 'b', importo: 10 }],
      quote: [{ membro_id: 'a', importo: 10 }] }
  ];
  var s = calcolaSaldi();
  assert.strictEqual(s.a, 0);
  assert.strictEqual(s.b, 0);
});
test('i membri rimossi non compaiono nei saldi', function(){
  membriCorrente = [{ id: 'a' }];
  S.movimenti = [
    { tasso_cambio: 1, paganti: [{ membro_id: 'rimosso', importo: 10 }],
      quote: [{ membro_id: 'a', importo: 5 }, { membro_id: 'rimosso', importo: 5 }] }
  ];
  var s = calcolaSaldi();
  assert.deepStrictEqual(Object.keys(s), ['a']);
  assert.strictEqual(s.a, -5);
});

// ── simplificaDebiti ──
console.log('\nsimplificaDebiti');
test('caso base: un creditore, due debitori', function(){
  membriCorrente = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  var saldi = { a: 10, b: -4, c: -6, d: 0 };
  var tx = simplificaDebiti(saldi);
  assert.ok(tx.length <= 3);
  var netto = { a: 1000, b: -400, c: -600, d: 0 };
  tx.forEach(function(t){ netto[t.da] += cent(t.importo); netto[t.a] -= cent(t.importo); });
  Object.keys(netto).forEach(function(k){ assert.strictEqual(netto[k], 0); });
});
test('fuzz: azzera sempre tutti, in al massimo n−1 mosse', function(){
  for(var k = 0; k < 300; k++){
    var n = 2 + Math.floor(Math.random() * 8);
    membriCorrente = [];
    for(var i = 0; i < n; i++) membriCorrente.push({ id: 'm' + i });
    var cents = membriCorrente.map(function(){ return Math.floor(Math.random() * 20001) - 10000; });
    cents[0] -= cents.reduce(function(a,b){ return a + b; }, 0);   // somma zero
    var saldi = {}, netto = {};
    membriCorrente.forEach(function(m, i){ saldi[m.id] = cents[i] / 100; netto[m.id] = cents[i]; });
    var tx = simplificaDebiti(saldi);
    tx.forEach(function(t){
      assert.ok(t.importo > 0);
      netto[t.da] += cent(t.importo); netto[t.a] -= cent(t.importo);
    });
    membriCorrente.forEach(function(m){ assert.strictEqual(netto[m.id], 0); });
    assert.ok(tx.length <= n - 1);
  }
});

// ── formattazione ──
console.log('\nformattazione');
test('eur: virgola + spazio unificatore + €', function(){
  assert.strictEqual(eur(12.3), '12,30 €');
});
test('eur: sempre valore assoluto (il segno lo mette la UI)', function(){
  assert.strictEqual(eur(-5), '5,00 €');
});
test('importoCon: simbolo per valuta nota, codice per le altre', function(){
  assert.strictEqual(importoCon(9.9, 'GBP'), '9,90 £');
  assert.strictEqual(importoCon(9.9, 'SEK'), '9,90 SEK');
});
test('escapeHtml: neutralizza tag, attributi e ampersand', function(){
  assert.strictEqual(escapeHtml('<b a="x">&'), '&lt;b a=&quot;x&quot;&gt;&amp;');
});
test('registroMultiMese: true solo con mesi diversi', function(){
  assert.strictEqual(registroMultiMese([{ data: '2026-07-01' }, { data: '2026-07-28' }], 'data'), false);
  assert.strictEqual(registroMultiMese([{ data: '2026-06-30' }, { data: '2026-07-01' }], 'data'), true);
});

// ── esito ──
console.log('\n' + passati + ' passati, ' + falliti + ' falliti');
if(falliti){ process.exit(1); }
