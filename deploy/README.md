# Deploying the API

One DigitalOcean droplet running three containers: Caddy (TLS, reverse proxy), the API, and
Postgres. `compose.yml`, `Caddyfile` and `backup.sh` are copied to `/opt/cuzhane` **by CI on
every deploy** — edit them here, never on the box, or the next release overwrites your change.

`/opt/cuzhane/.env` is the exception: it holds the secrets, lives only on the droplet, and is
never in this repository. Build it from `.env.example` and `chmod 600` it.

## GitHub secrets the workflow needs

| Secret             | What it is                                                      |
| ------------------ | --------------------------------------------------------------- |
| `DROPLET_HOST`     | The droplet's IP or hostname                                    |
| `DROPLET_USER`     | The SSH user the deploy connects as                             |
| `DROPLET_SSH_KEY`  | That user's **private** key                                     |
| `DROPLET_HOST_KEY` | The droplet's public host key — `ssh-keyscan -t ed25519 <host>` |
| `DROPLET_DOMAIN`   | The API's hostname, for the post-deploy smoke test              |

`DROPLET_HOST_KEY` is what stops the deploy trusting whatever answers on that IP. Without it
the connection is trust-on-first-use, which is no check at all in a fresh runner.

CI authenticates to GHCR with the workflow's own `GITHUB_TOKEN`, so nothing extra is needed to
_push_ the image.

## The droplet's registry login

The repository is private, so the container image is private too — and it has to be: the image
carries the whole server source. The droplet therefore needs its own credentials to pull it,
once:

```sh
# A classic personal access token with the single scope `read:packages`.
ssh <droplet>
echo '<token>' | docker login ghcr.io -u Slmii --password-stdin
```

Two things about that token. It is stored in `/root/.docker/config.json` **base64-encoded, not
encrypted**, so give it `read:packages` and nothing else — it must not be able to write code or
packages. And if you set an expiry, put the date in a calendar: when it lapses, deploys start
failing at `docker compose pull` with `denied`, which reads like a broken pipeline rather than
an expired credential.

**Write access to `main` is production access.** This workflow builds and deploys whatever is
pushed, and the API holds the database credentials and the Clerk secret. Branch protection with
required review on `main` — and on `.github/workflows/**`, `deploy/**` and the Dockerfile in
particular — is the control that matters here; nothing further down the pipeline can substitute
for it.

## Deploying

Push to `main`. CI builds the image, tags it with the commit sha, copies the deployment files
up, takes a database dump, pulls, and restarts — then blocks on the API's healthcheck and
finishes with an HTTPS request to `/health`. A red job means production did not change, or
changed and failed; either way, look before pushing again.

## Rolling back

The image is tagged with every commit sha, so:

```sh
ssh <droplet>
cd /opt/cuzhane
IMAGE_TAG=<previous-sha> docker compose up -d --wait
```

Make it stick by setting `IMAGE_TAG` in `/opt/cuzhane/.env`, otherwise the next deploy — or
anyone running plain `docker compose up` — goes back to `latest`.

**A code rollback does not roll back a migration.** If the release you are backing out of
changed the schema in a way the old code cannot read, the old image will fail too. This is why
migrations should be expand/contract: add a column and deploy, backfill, and only drop the old
one in a later release, so that at every point the previous image still runs.

## When a migration fails

This is the failure mode worth knowing before it happens. Prisma records the attempt in
`_prisma_migrations` with `finished_at` null, and **every later `prisma migrate deploy` then
refuses to do anything** with `P3009` — including the one inside the image you roll back to.
The stack will crash-loop until it is resolved by hand:

```sh
cd /opt/cuzhane
docker compose logs api | tail -50          # find the migration's name and the SQL error

# It did not apply (the usual case — Postgres runs a migration file as one statement,
# so it is normally all or nothing):
docker compose run --rm --no-deps api ./node_modules/.bin/prisma migrate resolve --rolled-back <migration-name>

# It did apply and only the bookkeeping failed:
docker compose run --rm --no-deps api ./node_modules/.bin/prisma migrate resolve --applied <migration-name>

docker compose up -d --wait
```

Take the dump in `/opt/cuzhane/backups` seriously before doing either — it is from immediately
before the deploy that broke.

## Backups

`backup.sh` dumps the database, gzips it, verifies the archive and keeps fourteen days. CI runs
it before every deploy. **Enable the nightly cron as well:**

```sh
(crontab -l 2>/dev/null; echo '0 3 * * * /opt/cuzhane/backup.sh >> /var/log/cuzhane-backup.log 2>&1') | crontab -
```

These dumps sit on the same disk as the database they came from, which means they survive a bad
migration and nothing else — not a deleted droplet, not a corrupted filesystem, not
`docker compose down -v`. Copying them somewhere else (Spaces, encrypted with `age`) is the
actual plan. `BabRead` is append-only and exists in no other system: losing it loses every
member's reading history permanently.

## Things not to do

-   **Never add `ports:` to the postgres service.** Docker writes its own iptables rules and a
    published port bypasses ufw entirely — the database would be on the public internet with the
    firewall still reporting that it is closed. It is reachable from the `back` network and that
    is enough.
-   **Never `docker compose down -v`.** The `-v` deletes the `pgdata` volume. So does
    `docker system prune --volumes`.
-   Don't edit `/opt/cuzhane/compose.yml` or `Caddyfile` on the box. CI overwrites them.
