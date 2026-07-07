// ESLint per sPiccioli! — regole di sola correttezza (niente stile).
// Il codice è vanilla ES5-style con globali condivise tra file caricati
// in sequenza: no-undef resterebbe cieco o urlerebbe a vuoto, quindi è
// spento; le regole attive pescano bug reali (chiavi duplicate, rami
// irraggiungibili, typeof sbagliati…).
export default [
  {
    files: ["*.js", "test/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script"
    },
    rules: {
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-cond-assign": "error",
      "no-constant-condition": ["error", { "checkLoops": false }],
      "no-compare-neg-zero": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-sparse-arrays": "error",
      "no-unsafe-negation": "error",
      "no-dupe-else-if": "error",
      "no-setter-return": "error",
      "no-unmodified-loop-condition": "error",
      "use-isnan": "error",
      "valid-typeof": "error"
    }
  }
];
