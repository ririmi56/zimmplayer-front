/**
 * Version de l'application, affichee en bas de la barre laterale.
 *
 * Doit rester egale a celle de `package.json` : `version.test.ts` le verifie,
 * car rien d'autre ne relie les deux et une version fausse a l'ecran est pire
 * qu'aucune version. Un simple `import` du manifeste ferait l'affaire dans
 * l'application, mais imposerait `resolveJsonModule` et des attributs
 * d'import a `vite.config.ts` (module `nodenext`) : une constante et un test
 * coutent moins cher que ce reglage-la.
 */
export const VERSION = '1.0.0'
