# Zimmplayer — Front

Client web d'un lecteur de musique auto-hébergé pour une bibliothèque stockée
sur S3/MinIO, conçu pour fonctionner sur un **réseau airgap** : aucune
dépendance réseau externe dans le bundle. L'API correspondante vit dans le
dépôt sœur [`zimmplayer-back`](https://github.com/ririmi56/zimmplayer-back).

React + TanStack Query + Zustand + Tailwind, servi statique (aucun rendu
serveur).

## Développement

Nécessite l'API (`zimmplayer-back`) démarrée sur `localhost:8000`.

```bash
npm install
npm run dev          # http://localhost:5173
```

Le serveur de dev Vite relaie `/api` et `/s3` vers l'API et MinIO, comme le
ferait un reverse proxy en production : le développement emprunte donc le même
chemin que la production, y compris pour les URLs présignées.

Après toute modification de l'API, régénérer les types :

```bash
npx openapi-typescript http://localhost:8000/api/openapi.json -o src/api/schema.d.ts
```

## Tests et build

```bash
npm run lint
npm test
npm run build
```

## Le navigateur comme client Snapcast

En mode session, ce client est à la fois la télécommande de la file (API REST)
et un **snapclient à part entière** — il joue le flux, synchronisé avec les
autres appareils, et apparaît comme n'importe quel client dans les groupes
Snapcast. Implémenté à partir de la spécification publique du protocole
binaire, et non du code de Snapweb, qui est sous **GPL-3.0** — le recopier
propagerait la licence à tout le projet. Voir `src/snapcast/`.

Trois choix qui simplifient beaucoup :

- Les flux de session sont publiés en `codec=pcm` : aucun décodeur à embarquer,
  là où flac ou opus exigeraient du WASM.
- L'audio transite par l'API (`/api/snapcast/stream`), qui relaie vers
  snapserver — une seule origine, donc compatible TLS, et l'adresse du serveur
  reste modifiable à chaud sans toucher au reverse proxy.
- La synchronisation suit la spécification : échanges `Time` réguliers,
  décalage d'horloge lissé par une **médiane** insensible aux valeurs
  aberrantes. Un morceau arrivé trop tard est jeté plutôt que joué en retard.

L'ouverture du son exige un **geste utilisateur** (politique d'autoplay des
navigateurs) : rejoindre une session déclenche déjà cette écoute dans le même
clic ; si le navigateur la bloque quand même, un second clic reste proposé.

## Licence

MIT, voir [`LICENSE`](./LICENSE).
