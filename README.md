# Zimmplayer — Front

[![Docker](https://github.com/ririmi56/zimmplayer-front/actions/workflows/docker.yml/badge.svg)](https://github.com/ririmi56/zimmplayer-front/actions/workflows/docker.yml)

Client web d'un lecteur de musique auto-hébergé pour une bibliothèque stockée
sur S3/MinIO, conçu pour fonctionner sur un **réseau airgap** : aucune
dépendance réseau externe dans le bundle. L'API correspondante vit dans le
dépôt sœur [`zimmplayer-back`](https://github.com/ririmi56/zimmplayer-back).

React + TanStack Query + Zustand + Tailwind, servi statique (aucun rendu
serveur).

## Image Docker

Publiée sur GHCR à chaque push sur `master` (voir
[`.github/workflows/docker.yml`](./.github/workflows/docker.yml)), en
`linux/amd64` et `linux/arm64` :

```bash
docker pull ghcr.io/ririmi56/zimmplayer-front:latest
```

| Tag | Correspond à |
|---|---|
| `latest` | dernier commit sur `master` |
| `X.Y.Z`, `X.Y` | tag Git `vX.Y.Z` |
| `<sha court>` | un commit précis, pour figer ou revenir en arrière |

Le conteneur sert le bundle statique et fait office de reverse proxy unique
(`/`, `/api`, `/s3`) via nginx, sur `:80`. Où proxifier `/api` et `/s3` se
règle par variable d'environnement, substituée dans la configuration au
démarrage (`nginx.conf.template`, mécanisme `envsubst` intégré à l'image nginx
officielle — rien de fait main) :

| Variable | Défaut | Rôle |
|---|---|---|
| `API_UPSTREAM` | `http://api:8000` | Cible de `/api/*` |
| `MINIO_UPSTREAM` | `http://minio:9000` | Cible de `/s3/*` |

Les défauts correspondent aux noms de service attendus par le
`docker-compose.yml` du dépôt principal — un simple `docker compose up`
fonctionne donc sans rien configurer. Si l'API ou MinIO vivent ailleurs (autre
réseau, autre machine), les surcharger :

```bash
docker run -p 80:80 \
  -e API_UPSTREAM=http://mon-api:8000 \
  -e MINIO_UPSTREAM=http://mon-minio:9000 \
  ghcr.io/ririmi56/zimmplayer-front:latest
```

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
