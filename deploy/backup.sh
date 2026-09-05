#!/usr/bin/env bash
# Database dump. Installed on the droplet as /opt/cuzhane/backup.sh, run from cron and once
# more by CI immediately before every deploy:
#
#   chmod +x /opt/cuzhane/backup.sh
#   (crontab -e) 0 3 * * * /opt/cuzhane/backup.sh >> /var/log/cuzhane-backup.log 2>&1
#
# `BabRead` is append-only and is the only record of who read what — a dropped volume is not
# recoverable from anywhere else. Fourteen days on the box is the floor, not the plan: these
# dumps share a disk, a droplet and a blast radius with the database itself, so copy them off
# the box as well, or one `docker compose down -v` takes the backups with it.

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

docker compose -f /opt/cuzhane/compose.yml exec -T postgres \
	pg_dump -U cuzhane -d cuzhane --clean --if-exists | gzip >"$FILE"

# A dump that failed halfway still leaves a file, so check it decompresses before trusting it
# and before the pruning below removes an older, good one. This proves the gzip, not that
# Postgres can restore it — restore-test into a scratch database now and then.
gzip -t "$FILE"

find "$DIR" -name 'cuzhane-*.sql.gz' -mtime +$KEEP_DAYS -delete

echo "$(date -Is) backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
