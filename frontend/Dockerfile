# The page. Vite builds static files, so Node is only needed to build them — what ships is nginx,
# which also passes /api through to the backend.
FROM node:24-bookworm-slim AS build

# The repo layout is kept, because the source reaches back out of frontend/ for shared/types.ts.
WORKDIR /repo/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY shared/ /repo/shared/
COPY frontend/ /repo/frontend/

# Vite bakes its settings into the page as it builds, so the tile source is a build argument rather
# than something the running container reads. Left empty, the map uses OpenFreeMap's hosted tiles.
ARG VITE_PMTILES_URL=""
ENV VITE_PMTILES_URL=$VITE_PMTILES_URL

RUN npm run build

FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html

EXPOSE 80
