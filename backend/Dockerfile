# The API. Nothing is compiled — tsx runs the TypeScript as it is — so this image is the dependencies,
# a browser, and the source.
#
# Node is pinned rather than taking whatever the Playwright image ships, because places.ts imports
# node:sqlite, which only stops needing a flag in Node 23.4. Bookworm is named outright because that is
# the Debian release Playwright installs browser dependencies for.
FROM node:24-bookworm-slim

# Outside /root, so the unprivileged user this ends up running as can read the browser.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# The repo layout is kept, because the source reaches back out of backend/ for shared/types.ts.
WORKDIR /repo/backend

COPY backend/package.json backend/package-lock.json ./
# tsx is the entry point and lives in devDependencies, so those are installed too.
RUN npm ci --include=dev

# Chromium and the system libraries it needs, matching the Playwright just installed. Only used for
# careers pages whose job list is built by JavaScript; RENDER_JS=false skips it at runtime.
RUN npx playwright install --with-deps chromium

COPY shared/ /repo/shared/
COPY backend/ /repo/backend/

ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["npm", "start"]
