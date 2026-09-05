# syntax=docker/dockerfile:1

# Built from the **repo root** as context, not from this folder: the API is one package in a
# pnpm workspace, so the lockfile, the workspace file and `.npmrc` all live a level up and the
# install cannot be resolved without them.
#
#   docker build -f apps/server/Dockerfile .

# Pinned to the minor, not to `22`: a major bump should be a commit somebody reviewed, and the
# patch line still arrives on its own.
FROM node:22.23-bookworm-slim AS base

# In `base`, so **both** stages have it. Prisma's engine links against OpenSSL, and the slim
# image ships none: without this `prisma generate` cannot detect a version, warns, and falls
# back to the openssl-1.1.x engine — which is not what bookworm runs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS build

# **Corepack belongs to the build alone.** Enabling it in `base` put pnpm's shim on the runtime
# image's PATH too, and the shim downloads the pnpm tarball from npm the first time it runs —
# which, since the runtime stage starts from `base` again and never inherits the build's
# corepack cache, meant every single container start fetched pnpm from the internet before the
# API could boot. An npm outage, or a repeat of the January 2025 corepack signing-key change,
# would have taken production down on the next deploy.
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
RUN corepack enable

# The manifests first, so a change to source code doesn't invalidate the install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/server/package.json apps/server/

# `@cuzhane/server...` is the package and everything it depends on.
#
# **The linker is overridden here.** The repo's `.npmrc` sets `node-linker=hoisted` because
# Metro and patch-package need a flat tree — that is the phone's requirement, not the API's,
# and hoisted resolves the whole lockfile into one root `node_modules`, so the server image
# came out carrying react-native, expo, viem and solana: 1.1 GB of dependencies it never
# imports. Isolated linking installs only what the filter asked for.
ENV NPM_CONFIG_NODE_LINKER=isolated
RUN pnpm install --frozen-lockfile --filter @cuzhane/server...

COPY apps/server apps/server

# Generate before compiling: `src/generated/prisma` is gitignored, so it does not exist in the
# build context and `tsc` would fail on the import.
#
# The placeholder URL is required but never dialled: `prisma.config.ts` resolves
# `env('DATABASE_URL')` as it loads, and generating a client makes no connection. The real one
# arrives from compose at boot, when `migrate deploy` runs. It is a `RUN`-scoped variable
# rather than an `ENV`, so it is not baked into the image.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    pnpm --filter @cuzhane/server db:generate \
    && pnpm --filter @cuzhane/server build

FROM base AS runtime
ENV NODE_ENV=production

# Dev dependencies included. `prisma migrate deploy` runs at boot and the CLI is a dev
# dependency — pruning it would save a couple of hundred megabytes and cost the one thing that
# must work on every deploy.
#
# **Two copies, not one**, so the deploy pulls megabytes rather than half a gigabyte:
# `node_modules` is its own layer and only changes when the lockfile does, while the layer that
# changes on every push is the app itself. The workspace root's `package.json`, `.npmrc` and
# `pnpm-workspace.yaml` are deliberately *not* copied — nothing at runtime reads them, and the
# `.npmrc` is the file a registry token would one day be written into.
#
# `--chown` rather than a `chown -R` afterwards: rewriting the ownership of half a gigabyte
# would double the image's size in a second layer.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/server ./apps/server

# Not root. An RCE in the API then lands as an unprivileged user that cannot rewrite the
# application it is running from — which is also what lets compose mount the filesystem
# read-only.
USER node

WORKDIR /app/apps/server
EXPOSE 3001

# Migrations run before the server accepts a request. `migrate deploy` is idempotent and only
# applies what is pending, so a restart that changes nothing costs a round trip. One container
# only — two replicas would race here. **A failed migration wedges every later boot with
# P3009, including a rollback to the previous image** — see `deploy/README.md`.
#
# The CLI is called by path rather than through `pnpm exec`, which would drag corepack into the
# runtime (see the build stage), and `exec` hands PID 1 to node: without it `sh` stays PID 1,
# swallows the SIGTERM that `docker stop` sends, and the graceful shutdown in `index.ts` never
# runs — every deploy would kill in-flight requests after a ten-second wait.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/index.js"]
