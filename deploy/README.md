# Deploying the API

One DigitalOcean droplet running three containers: Caddy (TLS, reverse proxy), the API, and
Postgres. `compose.yml`, `Caddyfile` and `backup.sh` are copied to `/opt/cuzhane` **by CI on
every deploy** — edit them here, never on the box, or the next release overwrites your change.

`/opt/cuzhane/.env` is the exception: it holds the secrets, lives only on the droplet, and is
never in this repository. Build it from `.env.example` and `chmod 600` it.

## GitHub secrets the workflow needs

| Secret                   | What it is                                                      |
| ------------------------ | --------------------------------------------------------------- |
| `DROPLET_HOST`           | The droplet's IP or hostname                                    |
| `DROPLET_USER`           | The SSH user the deploy connects as                             |
| `DROPLET_SSH_KEY`        | That user's **private** key                                     |
| `DROPLET_HOST_KEY`       | The droplet's public host key — `ssh-keyscan -t ed25519 <host>` |
| `DROPLET_DOMAIN`         | The API's hostname, for the post-deploy smoke test              |
| `DROPLET_PREVIEW_DOMAIN` | The preview API's hostname, for the same test on `development`  |

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

## Two environments on one droplet

`main` deploys the **production** API; `development` deploys the **preview** one beside it. They
share the box, the Caddy in front and the Postgres behind — but run as different containers
against different databases (`cuzhane` and `cuzhane_preview`), and each is pinned by its own tag
variable (`IMAGE_TAG`, `PREVIEW_IMAGE_TAG`) so deploying one never moves the other's image.

Preview exists so the `development` branch and the Expo `preview` channel have something that is
not production to run against. Before it, `preview` builds resolved `EXPO_PUBLIC_API_URL` to the
production host and read and wrote live rows.

**One Postgres, two databases.** A second instance does not fit beside the first on 2 GB. A
second database still isolates the data — a preview migration cannot touch a production row —
but not the process: a preview query storm or a Postgres crash takes production with it. That
holds while preview is a couple of developers; the answer when it stops is a second droplet.

### The one manual step, once

`POSTGRES_DB` only runs against an empty data directory, so the preview database is created by
hand:

```sh
docker compose exec postgres psql -U cuzhane -d cuzhane \
  -c 'CREATE DATABASE cuzhane_preview OWNER cuzhane;'
```

The API runs its own migrations at boot, so an empty database is all it needs. Add
`PREVIEW_DOMAIN` to `/opt/cuzhane/.env` **before** the first deploy carrying the new compose
file, or `docker compose config` fails the job.

Resetting preview is dropping and recreating that database — never do it to `cuzhane`.

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

## Restoring

Two paths, and which one you want depends on what went wrong.

### From a local dump — no key needed

For the ordinary emergency: a bad migration, a wrong `DELETE`, anything where the droplet is
still standing. The dumps in `/opt/cuzhane/backups` are plain gzip, so this needs nothing but
SSH.

```sh
ssh <droplet>
cd /opt/cuzhane
ls -t backups/                       # newest first
zcat backups/cuzhane-<stamp>.sql.gz |
  docker compose exec -T postgres psql -U cuzhane -d cuzhane
```

The dumps carry `--clean --if-exists`, so they drop and recreate each table as they go. Stop the
API first (`docker compose stop api`) if you would rather it not write during the restore.

### From R2 — the private key never goes near the droplet

For when the droplet is gone, or its disk with it. The object is encrypted to a public key the
server holds; only `~/cuzhane-backup-key.txt` on your machine can read it. So the decryption
happens **on your machine, in the middle of the pipe** — the ciphertext comes down, the plaintext
goes back up inside SSH, and the key is never copied anywhere.

```sh
# From your machine. Pick the object first:
ssh <droplet> 'rclone --config /root/.config/rclone/rclone.conf lsl r2:cuzhane-backups/db'

# Then stream: download → decrypt locally → restore over ssh.
ssh <droplet> 'rclone --config /root/.config/rclone/rclone.conf cat r2:cuzhane-backups/db/<file>.age' |
  age -d -i ~/cuzhane-backup-key.txt |
  gunzip |
  ssh <droplet> 'cd /opt/cuzhane && docker compose exec -T postgres psql -U cuzhane -d cuzhane'
```

Rebuilding on a **fresh** droplet is the same pipe with the last step pointed at the new box, after
`docker compose up -d` has created an empty database.

**Copying the key to the server "just for the restore" defeats the whole arrangement.** The reason
the droplet cannot read its own backups is that taking the server must not hand over every user's
email address and reading history. A key pasted there during an incident is a key that was there
while you were distracted.

And the corollary: `~/cuzhane-backup-key.txt` is the only thing that can read anything in R2. It
belongs in a password manager as well as on the laptop — one machine is one failure away from
ninety days of unreadable noise.

## Connecting a database client

Postgres is bound to the droplet's loopback, so a client reaches it through SSH rather than over
the network. In DBeaver: a **PostgreSQL** connection whose _SSH_ tab is enabled.

| Field           | Value                                        |
| --------------- | -------------------------------------------- |
| SSH host / port | the droplet's IP, `22`                       |
| SSH user        | `root`                                       |
| SSH auth        | Public key → `~/.ssh/digitalocean_sbytes`    |
| Database host   | `localhost` (resolved **on the droplet**)    |
| Database port   | `5432`                                       |
| Database / user | `cuzhane` / `cuzhane`                        |
| Password        | `POSTGRES_PASSWORD` from `/opt/cuzhane/.env` |

The database host is `localhost` because DBeaver resolves it at the far end of the tunnel. Putting
the droplet's public IP there instead is the usual mistake — it would try to reach 5432 across the
internet, where nothing is listening.

The same thing without a GUI:

```sh
ssh -L 5433:localhost:5432 <droplet>   # then connect to localhost:5433 locally
```

**This is a superuser connection to production.** There is no read-only role: a stray `UPDATE`
with no `WHERE` lands on real data, and `BabRead` is the one table that cannot be reconstructed.
Take a dump before anything you have not run before — `/opt/cuzhane/backup.sh`.

## Things not to do

-   **Never publish postgres on `0.0.0.0`.** Docker writes its own iptables rules ahead of ufw, so
    a bare `5432:5432` puts the database on the public internet while `ufw status` still reports
    the port as closed. The published mapping is `127.0.0.1:5432:5432` — loopback only, reachable
    from the droplet itself and from nothing else, which is what the SSH tunnel below connects to.
    Dropping the `127.0.0.1` prefix is the whole difference between the two.
-   **Never `docker compose down -v`.** The `-v` deletes the `pgdata` volume. So does
    `docker system prune --volumes`.
-   Don't edit `/opt/cuzhane/compose.yml` or `Caddyfile` on the box. CI overwrites them.
