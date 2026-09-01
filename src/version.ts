/**
 * Version de l'application, affichee en bas de la barre laterale.
 *
 * Le suffixe `-dev` marque une version en cours : la branche `1.1` publie une
 * image `1.1.0-dev`, et c'est la fusion sur master qui le retire. Voir ce que
 * l'ecran affiche est le moyen le plus simple de savoir si l'on teste la
 * version en preparation ou celle en service.
 *
 * Doit rester egale a celle de `package.json` : `version.test.ts` le verifie,
 * car rien d'autre ne relie les deux et une version fausse a l'ecran est pire
 * qu'aucune version. Un simple `import` du manifeste ferait l'affaire dans
 * l'application, mais imposerait `resolveJsonModule` et des attributs
 * d'import a `vite.config.ts` (module `nodenext`) : une constante et un test
 * coutent moins cher que ce reglage-la.
 */
export const VERSION = '1.1.0-dev'
