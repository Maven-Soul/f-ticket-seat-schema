# syntax=docker/dockerfile:1.7

FROM node:22.16-alpine3.20 AS build

WORKDIR /workspace

# The shared package is a separate build context supplied by docker compose.
COPY --from=seatmap-package / /workspace/fpass-seatmap-package

WORKDIR /workspace/fpass-sheme-studio
COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine3.20

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/fpass-sheme-studio/dist /usr/share/nginx/html

EXPOSE 8080
