#!/usr/bin/env bash
# Database dump. Installed on the droplet as /opt/cuzhane/backup.sh, run from cron and once
# more by CI immediately before every deploy:
#
#   chmod +x /opt/cuzhane/backup.sh
#   (crontab -e) 0 3 * * * /opt/cuzhane/backup.sh >> /var/log/cuzhane-backup.log 2>&1
#
# `BabRead` is append-only and is the only record of who read what — a dropped volume is not
# recoverable from anywhere else. Fourteen days on the box is the floor, not the plan: these
# dumps share a disk, a droplet and a blast radius with the database itself, so every dump is
# also encrypted and copied to Cloudflare R2 (see the bottom of this file), which is the copy
# that survives losing the droplet.

set -euo pipefail

# Before anything is created. A database dump is the whole application's data in one file, and
# the default umask would leave it readable by every user on the box.
umask 077

DIR=/opt/cuzhane/backups
KEEP_DAYS=14

mkdir -p "$DIR"

# Cron and the deploy can collide — a dump taken while another is running would be pruned by
# age alongside a good one. Second caller gives up rather than queueing.
exec 9>"$DIR/.lock"
flock -n 9 || {
	echo "$(date -Is) backup already running, skipping"
	exit 0
}

STAMP=$(date +%Y-%m-%d-%H%M%S)
FILE="$DIR/cuzhane-$STAMP.sql.gz"

# **`< /dev/null` is load-bearing.** `exec -T` still attaches stdin, and CI runs this script
# from inside a remote shell that is itself being fed through stdin (`ssh … bash -s <<'REMOTE'`).
# Without this redirect the dump consumed the rest of the deployment script: the backup ran, the
# pull and restart never did, and bash exited 0 — so the deploy reported success while production
# was never touched. It fooled us once precisely because it only bites when Postgres is already
# running, which is every deploy after the first.
docker compose -f /opt/cuzhane/compose.yml exec -T postgres \
	pg_dump -U cuzhane -d cuzhane --clean --if-exists </dev/null | gzip >"$FILE"

# A dump that failed halfway still leaves a file, so check it decompresses before trusting it
# and before the pruning below removes an older, good one. This proves the gzip, not that
# Postgres can restore it — restore-test into a scratch database now and then.
gzip -t "$FILE"

find "$DIR" -name 'cuzhane-*.sql.gz' -mtime +$KEEP_DAYS -delete

echo "$(date -Is) backup ok: $FILE ($(du -h "$FILE" | cut -f1))"

# ---------------------------------------------------------------------------------------------
# Off-site copy: encrypt, then push to Cloudflare R2.
#
# Configured by /opt/cuzhane/backup.env, which is **not** in this repository (it names a bucket
# and a key). Absent or incomplete, everything above still runs and this is skipped — a droplet
# that has not been given R2 credentials must still take local dumps.
#
# **Encrypted with a public key, and the private key is not on this machine.** `age -r` needs
# only the recipient, so the droplet can create backups it cannot itself read. That is the
# point: whoever takes the server does not thereby get every user's email address and reading
# history. The flip side is absolute — lose the private key and every off-site backup is
# permanently unreadable, so it belongs in a password manager, not in this repo and not on the
# droplet.
# ---------------------------------------------------------------------------------------------

if [ -r /opt/cuzhane/backup.env ]; then
	# shellcheck disable=SC1091
	. /opt/cuzhane/backup.env
fi

if [ -z "${AGE_RECIPIENT:-}" ] || [ -z "${R2_PATH:-}" ]; then
	echo "$(date -Is) offsite skipped (no AGE_RECIPIENT / R2_PATH in /opt/cuzhane/backup.env)"
	exit 0
fi

ENCRYPTED="$FILE.age"
age -r "$AGE_RECIPIENT" -o "$ENCRYPTED" "$FILE"

# `--no-traverse` because we are uploading one new file, not reconciling a directory: without it
# rclone lists the whole bucket first, which gets slower every night for no benefit.
rclone --config /root/.config/rclone/rclone.conf copy "$ENCRYPTED" "$R2_PATH" --no-traverse

rm -f "$ENCRYPTED"

# Longer than the local retention. Off-site is the copy you reach for when the local ones are
# gone with the droplet, and by then "how far back can I go" is the only question that matters.
rclone --config /root/.config/rclone/rclone.conf delete "$R2_PATH" \
	--min-age "${R2_KEEP_DAYS:-90}d"

echo "$(date -Is) offsite ok: $(basename "$ENCRYPTED") → $R2_PATH"

# ---------------------------------------------------------------------------------------------
# The hard ceiling. R2's free tier is 10 GB, and the bill starts silently the moment it is
# crossed — so age-based retention above is the intent and this is the guarantee. Oldest goes
# first, because the newest backup is the one most likely to be wanted.
#
# Sorting by filename is sorting by time: the names carry `YYYY-MM-DD-HHMMSS`, so lexical order
# is chronological order. That holds until the year 10000.
# ---------------------------------------------------------------------------------------------

BUDGET_BYTES=${R2_BUDGET_BYTES:-8589934592} # 8 GiB, leaving 2 GB of headroom under the free tier

r2_bytes_used() {
	rclone --config /root/.config/rclone/rclone.conf size "$R2_PATH" --json 2>/dev/null |
		sed -E 's/.*"bytes":[[:space:]]*([0-9]+).*/\1/'
}

used=$(r2_bytes_used)

while [ -n "$used" ] && [ "$used" -gt "$BUDGET_BYTES" ]; do
	oldest=$(rclone --config /root/.config/rclone/rclone.conf lsl "$R2_PATH" |
		sort -k4 | head -1 | awk '{print $1"\t"$4}')

	[ -n "$oldest" ] || break

	oldest_size=$(printf '%s' "$oldest" | cut -f1)
	oldest_name=$(printf '%s' "$oldest" | cut -f2)

	# Never delete the last remaining copy — an empty bucket is worse than an over-budget one,
	# and a single dump larger than the whole budget means the budget is wrong, not the backup.
	remaining=$(rclone --config /root/.config/rclone/rclone.conf lsf "$R2_PATH" | wc -l)
	if [ "$remaining" -le 1 ]; then
		echo "$(date -Is) offsite over budget with one copy left — not deleting it"
		break
	fi

	rclone --config /root/.config/rclone/rclone.conf deletefile "$R2_PATH/$oldest_name"
	echo "$(date -Is) offsite pruned to budget: removed $oldest_name"

	used=$((used - oldest_size))
done
