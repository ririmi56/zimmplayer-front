# Build du bundle : entierement autonome, aucun appel reseau a l'execution.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Sert le bundle et fait office de point d'entree unique (/, /api, /s3).
FROM nginx:1.27-alpine

# Valeurs par defaut : les noms de service attendus par docker-compose.yml du
# depot principal. A surcharger (`docker run -e API_UPSTREAM=...`) si l'API et
# MinIO vivent ailleurs. Substituees dans le modele au demarrage par le script
# d'entree standard de l'image nginx (voir nginx.conf.template).
ENV API_UPSTREAM=http://api:8000 \
    MINIO_UPSTREAM=http://minio:9000

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
