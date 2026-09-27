# Deploying the API

One server runs Caddy (TLS and reverse proxy), the API and Postgres as containers. The files in
this folder — `compose.yml`, `compose.preview.yml`, `Caddyfile` and `backup.sh` — are copied onto
the server **by CI on every deploy**, so they are edited here and never on the server itself; the
next deploy would overwrite a change made there.

Secrets are never in this repository. The server keeps them in its own `.env`, built from
`.env.example`. The operator's runbook — access, database connections, backups and restores —
is kept outside the repository.

## Two environments

| Branch        | Environment | Database          |
| ------------- | ----------- | ----------------- |
| `main`        | production  | `cuzhane`         |
| `development` | preview     | `cuzhane_preview` |

Both run on the same server behind the same Caddy, as separate containers against separate
databases, each pinned to its own image tag (`IMAGE_TAG`, `PREVIEW_IMAGE_TAG`) so deploying one
never moves the other. Preview is what the `development` branch and the Expo `preview` channel
run against.

**Each environment's API is configured from its own branch; what they share goes through
`main`.**

| File                  | Holds                                               | Shipped from           |
| --------------------- | --------------------------------------------------- | ---------------------- |
| `compose.yml`         | Caddy, Postgres, production's `api`                 | `main`, always ¹       |
| `Caddyfile`           | The edge for all three sites                        | `main`, always         |
| `backup.sh`           | The nightly dump root's cron runs                   | `main`, always         |
| `compose.preview.yml` | Preview's `api-preview`, and nothing else           | the branch deploying   |

¹ With any `api-preview` in it removed on the way up, so `development`'s preview file never
merges over a second copy — a no-op once `main` has this split.

So a new environment variable for preview is added to `compose.preview.yml` on `development` and
reaches preview with its next deploy; for production it is added to `compose.yml` on `main`. The
value itself goes in the server's `.env` by hand either way. The deploy refuses a
`compose.preview.yml` that defines anything but `api-preview` — compose merges files by service
name, so one could otherwise redefine production's services from `development`. A production
deploy leaves the server's `compose.preview.yml` alone (it only installs one if there is none).

The server's `.env` carries `COMPOSE_FILE=compose.yml:compose.preview.yml`, written by every
deploy, so a plain `docker compose` there sees both files.

## How a deploy runs

`deploy-server.yml` runs on a push to `main` or `development` that touches `apps/server/**`,
`deploy/**` or the root package files. It:

1. builds the server image and pushes it to GHCR, tagged with the commit sha;
2. copies the deployment files onto the server and, for production, takes a database dump;
3. validates the Caddy config, pulls the new image and restarts that environment's API;
4. waits for the API's healthcheck, then requests `/health` over HTTPS.

The API applies its own database migrations when it starts. A red job means the environment did
not change, or changed and failed — look before pushing again.

`deploy-marketing.yml` builds the Astro site in `apps/marketing` on a push to `main` and copies it
onto the same server.

## GitHub secrets the workflows expect

| Secret                    | What it is                                                     |
| ------------------------- | -------------------------------------------------------------- |
| `DROPLET_HOST`            | The server's IP or hostname                                    |
| `DROPLET_USER`            | The SSH user the deploy connects as                            |
| `DROPLET_SSH_KEY`         | That user's private key                                        |
| `DROPLET_HOST_KEY`        | The server's public host key (`ssh-keyscan -t ed25519 <host>`) |
| `DROPLET_DOMAIN`          | The production API's hostname, for the smoke test              |
| `DROPLET_PREVIEW_DOMAIN`  | The preview API's hostname, for the same test                  |
| `SITE_DOMAIN`             | The marketing site's hostname                                  |
| `CLAUDE_CODE_OAUTH_TOKEN` | For the Claude review workflows                                |

`DROPLET_HOST_KEY` is what stops a deploy trusting whatever answers on that address. CI pushes
the image with the workflow's own `GITHUB_TOKEN`.

**Write access to `main` is production access**, since the workflow deploys whatever is pushed
there. Branch protection with required review on `main` — and on `.github/workflows/**`,
`deploy/**` and the Dockerfile in particular — is the control that matters.

## The Hüsrev mushaf pages

The Kur'an reader's Hüsrev mode shows the edition's page images, and the Hatim duası its four
pages. They are **not in this repository or the image** (`apps/server/mushaf/` is gitignored and
excluded from the Docker build). The server mounts them read-only into both API containers at
`/app/apps/server/mushaf`, where they are served to signed-in users under `/api/mushaf/*`.
Without them the Hüsrev reader has nothing to draw; every other reader mode works.
