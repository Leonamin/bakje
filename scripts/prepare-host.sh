#!/bin/sh
set -eu

# One-time host bootstrap. Needs root (or the equivalent Docker workaround that
# is documented in the README when sudo is unavailable).
#
#   sudo ARCHIVE_UID=$(id -u) ARCHIVE_GID=$(id -g) ./scripts/prepare-host.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo (or as root)." >&2
  exit 1
fi

uid="${ARCHIVE_UID:-1000}"
gid="${ARCHIVE_GID:-1000}"

install -d -m 0755 -o "$uid" -g "$gid" /opt/bakje
install -d -m 0755 -o "$uid" -g "$gid" /opt/bakje/releases
install -d -m 0750 -o "$uid" -g "$gid" /var/lib/bakje
install -d -m 0750 -o "$uid" -g "$gid" /etc/bakje

env_file=/etc/bakje/bakje.env
if [ ! -f "$env_file" ]; then
  cat > "$env_file" <<'EOF'
# OpenAI-compatible endpoint used only for translation and summaries.
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
EOF
  chown "$uid:$gid" "$env_file"
  chmod 0600 "$env_file"
  echo "Wrote $env_file — fill in OPENAI_API_KEY."
fi

echo "Host ready. Deploy with: ./scripts/deploy.sh"
