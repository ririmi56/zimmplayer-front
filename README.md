# Zimmplayer — Front

[![Docker](https://github.com/ririmi56/zimmplayer-front/actions/workflows/docker.yml/badge.svg)](https://github.com/ririmi56/zimmplayer-front/actions/workflows/docker.yml)

Client web d'un lecteur de musique auto-hébergé pour une bibliothèque stockée
sur S3/MinIO, conçu pour fonctionner sur un **réseau airgap** : aucune
dépendance réseau externe dans le bundle. L'API correspondante vit dans le
dépôt sœur [`zimmplayer-back`](https://github.com/ririmi56/zimmplayer-back) ;
l'orchestration Docker Compose et le livrable airgap, dans
[`zimmplayer-deploy`](https://github.com/ririmi56/zimmplayer-deploy).

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

### Deux horloges, deux dérives

Le navigateur en compare **deux paires** d'horloges, et les traite différemment :

| Écart | Entre quoi | Correction |
|---|---|---|
| Décalage serveur | horloge de snapserver ↔ horloge locale | mesuré en continu par les messages `Time`, médiane glissante |
| Dérive d'ancrage | horloge locale ↔ horloge de l'`AudioContext` | recalage automatique au-delà de 15 ms |

La seconde est celle qu'on oublie : `AudioContext.currentTime` est cadencé par
le quartz de la carte son, `performance.now()` par celui du système. Ils
s'écartent de quelques millisecondes par dizaine de minutes — sur une longue
écoute, le navigateur finit décalé des enceintes sans qu'aucune mesure réseau
ne bouge. L'ancrage est donc revérifié à chaque morceau et recalé au-delà du
seuil (`snapcast/player.ts`).

Le recalage est un **saut**, pas un glissement : le morceau suivant est
programmé jusqu'à 15 ms plus tôt ou plus tard, d'où un très bref chevauchement
ou trou. C'est rare — la dérive met des minutes à atteindre le seuil — et
préférable à un décalage définitif.

Le bouton **« Resynchroniser »** de l'écran Configuration va plus loin : il jette
aussi l'estimation du décalage serveur et la reconstruit au rythme rapide du
démarrage (~1,5 s de silence). Utile après une mise en veille ou un changement
de réseau, quand c'est l'estimation elle-même qui est fausse.

Le même écran affiche les deux écarts, les morceaux joués et en retard, et le
nombre de recalages — de quoi voir une dérive anormale plutôt que de la
deviner.

**Les enceintes physiques ne sont pas concernées** : elles se recalent seules,
et l'API de snapserver n'offre aucun moyen de les y forcer (`Client.Resync` et
consorts n'existent pas, vérifié contre un snapserver 0.29), ni aucune mesure
de leur synchronisation.

L'ouverture du son exige un **geste utilisateur** (politique d'autoplay des
navigateurs) : rejoindre une session déclenche déjà cette écoute dans le même
clic ; si le navigateur la bloque quand même, un second clic reste proposé.

## Licence

MIT, voir [`LICENSE`](./LICENSE).
