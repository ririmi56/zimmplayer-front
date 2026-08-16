# Build du bundle : entierement autonome, aucun appel reseau a l'execution.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Sert le bundle et fait office de point d'entree unique (/, /api, /s3).
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
