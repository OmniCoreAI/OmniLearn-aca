#!/usr/bin/env bash
#
# OmniLearn — one-shot deploy for a DigitalOcean droplet (Ubuntu/Debian).
#
# Installs everything the stack needs and wires the services together:
#   • Docker Engine + Compose plugin      (runs db + redis + app)
#   • host nginx reverse proxy            (public domain → container)
#   • Let's Encrypt TLS via certbot       (optional, when --domain + --email given)
#   • a generated, secret-filled .env     (created once, never overwritten)
#
# It is idempotent: run it for the first install AND for every later update.
#
# ── Quick start on a fresh droplet ─────────────────────────────────────────
#   git clone <repo> /opt/omnilearn && cd /opt/omnilearn
#   sudo ./deploy/deploy.sh --domain lms.example.com --email you@example.com
#
# Local / IP-only (no domain, no TLS):
#   sudo ./deploy/deploy.sh
#
# Update an existing install (rebuild + restart, skip apt work):
#   git pull && sudo ./deploy/deploy.sh --update
#
# Flags / env vars (flag wins over env var):
#   --domain <d>   | DOMAIN=<d>     public hostname served by nginx
#   --email  <e>   | EMAIL=<e>      email for Let's Encrypt registration
#   --update       | UPDATE=1       skip system package install (faster redeploy)
#   --no-tls       | NO_TLS=1       configure nginx on :80 only, skip certbot
#   --no-nginx     | NO_NGINX=1     skip host nginx (expose container port directly)
#   -h | --help                     show this help
# ---------------------------------------------------------------------------

set -euo pipefail

# ── locate repo root (this script lives in <repo>/deploy) ──────────────────
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd)"
cd "${REPO_ROOT}"

ENV_FILE="${REPO_ROOT}/.env"
ENV_EXAMPLE="${REPO_ROOT}/.env.example"
NGINX_TEMPLATE="${SCRIPT_DIR}/nginx-host.conf.template"
NGINX_SITE_NAME="omnilearn"

# ── defaults (overridable by env, then flags) ──────────────────────────────
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
UPDATE="${UPDATE:-0}"
NO_TLS="${NO_TLS:-0}"
NO_NGINX="${NO_NGINX:-0}"

# ── pretty logging ─────────────────────────────────────────────────────────
c_reset=$'\033[0m'; c_blue=$'\033[1;34m'; c_green=$'\033[1;32m'
c_yellow=$'\033[1;33m'; c_red=$'\033[1;31m'
step() { printf '\n%s==>%s %s\n' "$c_blue" "$c_reset" "$*"; }
info() { printf '%s •%s %s\n' "$c_green" "$c_reset" "$*"; }
warn() { printf '%s ![]%s %s\n' "$c_yellow" "$c_reset" "$*" >&2; }
die()  { printf '%s ✗%s %s\n' "$c_red" "$c_reset" "$*" >&2; exit 1; }

usage() { sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

# ── parse flags ────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2;;
    --domain=*) DOMAIN="${1#*=}"; shift;;
    --email) EMAIL="${2:-}"; shift 2;;
    --email=*) EMAIL="${1#*=}"; shift;;
    --update) UPDATE=1; shift;;
    --no-tls) NO_TLS=1; shift;;
    --no-nginx) NO_NGINX=1; shift;;
    -h|--help) usage;;
    *) die "Unknown argument: $1 (use --help)";;
  esac
done

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    die "Run as root (e.g. 'sudo ./deploy/deploy.sh ...')."
  fi
}

# ── secret helper: URL-safe, ~43 chars, like python secrets.token_urlsafe(32)
gen_secret() {
  openssl rand -base64 48 | tr -d '\n' | tr '+/' '-_' | tr -d '=' | cut -c1-43
}

# Return 0 if key is missing or still a placeholder in .env.
needs_value() {
  local key="$1" line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -n1 || true)"
  [ -z "$line" ] && return 0
  case "${line#*=}" in
    ""|generate-with-*|change-me|changeme) return 0;;
    *) return 1;;
  esac
}

# Idempotently set key=value in .env (append if missing, replace otherwise).
set_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # Use a temp file so any char in value is safe (no sed metachar issues).
    awk -v k="$key" -v v="$value" '
      BEGIN{FS=OFS="="}
      $1==k{print k "=" v; done=1; next}
      {print}
      END{if(!done) print k "=" v}
    ' "$ENV_FILE" > "${ENV_FILE}.tmp" && mv "${ENV_FILE}.tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# 1. System dependencies
# ═══════════════════════════════════════════════════════════════════════════
install_system_deps() {
  if [ "$UPDATE" = "1" ]; then
    info "--update: skipping system package installation."
    return
  fi
  step "Installing system dependencies"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg openssl ufw

  if ! command -v docker >/dev/null 2>&1; then
    info "Installing Docker Engine + Compose plugin"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    local codename
    codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-stable}")"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${codename} stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io \
      docker-buildx-plugin docker-compose-plugin
  else
    info "Docker already installed ($(docker --version))"
  fi
  systemctl enable --now docker >/dev/null 2>&1 || true

  if [ "$NO_NGINX" != "1" ]; then
    command -v nginx >/dev/null 2>&1 || { info "Installing nginx"; apt-get install -y nginx; }
    if [ -n "$DOMAIN" ] && [ "$NO_TLS" != "1" ]; then
      command -v certbot >/dev/null 2>&1 || {
        info "Installing certbot"; apt-get install -y certbot python3-certbot-nginx;
      }
    fi
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# 2. Firewall (only touch it when ufw is present/active-able)
# ═══════════════════════════════════════════════════════════════════════════
configure_firewall() {
  command -v ufw >/dev/null 2>&1 || return 0
  [ "$UPDATE" = "1" ] && return 0
  step "Configuring firewall (ufw)"
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
  if [ "$NO_NGINX" = "1" ]; then
    local port; port="$(grep -E '^HTTP_PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)"
    ufw allow "${port:-8080}/tcp" >/dev/null 2>&1 || true
  else
    ufw allow 'Nginx Full' >/dev/null 2>&1 || { ufw allow 80/tcp; ufw allow 443/tcp; }
  fi
  yes | ufw enable >/dev/null 2>&1 || true
  info "Firewall rules applied."
}

# ═══════════════════════════════════════════════════════════════════════════
# 3. Environment file (.env) — created once, secrets auto-generated
# ═══════════════════════════════════════════════════════════════════════════
prepare_env() {
  step "Preparing environment (.env)"
  if [ ! -f "$ENV_FILE" ]; then
    [ -f "$ENV_EXAMPLE" ] || die "Missing $ENV_EXAMPLE"
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    info "Created .env from .env.example"
  else
    info ".env already exists — keeping it (only filling gaps)."
  fi

  # Ensure core service settings the compose stack relies on.
  grep -qE '^HTTP_PORT='  "$ENV_FILE" || set_env HTTP_PORT 8080
  grep -qE '^COLLAB_PORT=' "$ENV_FILE" || set_env COLLAB_PORT 4040
  grep -qE '^POSTGRES_USER='     "$ENV_FILE" || set_env POSTGRES_USER omnilearn
  grep -qE '^POSTGRES_DB='       "$ENV_FILE" || set_env POSTGRES_DB omnilearn
  needs_value POSTGRES_PASSWORD && set_env POSTGRES_PASSWORD "$(gen_secret)"

  # DB connection string uses the compose service name `db` (rewritten to the
  # published host port automatically when running outside Docker).
  local pu pp pd
  pu="$(grep -E '^POSTGRES_USER='     "$ENV_FILE" | cut -d= -f2)"
  pp="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
  pd="$(grep -E '^POSTGRES_DB='       "$ENV_FILE" | cut -d= -f2)"
  if needs_value OMNILEARN_SQL_CONNECTION_STRING; then
    set_env OMNILEARN_SQL_CONNECTION_STRING "postgresql://${pu}:${pp}@db:5432/${pd}"
  fi

  # Secrets: generate any that are missing or still placeholders.
  needs_value OMNILEARN_AUTH_JWT_SECRET_KEY && set_env OMNILEARN_AUTH_JWT_SECRET_KEY "$(gen_secret)"
  needs_value NEXTAUTH_SECRET               && set_env NEXTAUTH_SECRET "$(gen_secret)"
  needs_value COLLAB_INTERNAL_KEY           && set_env COLLAB_INTERNAL_KEY "$(gen_secret)"

  # Bind the container port privately when the host nginx sits in front of it,
  # publicly otherwise (Docker bypasses ufw, so this is the real access control).
  if [ "$NO_NGINX" = "1" ]; then
    set_env APP_BIND 0.0.0.0
  else
    set_env APP_BIND 127.0.0.1
  fi

  # Domain wiring for the frontend + auth callbacks.
  if [ -n "$DOMAIN" ]; then
    set_env OMNILEARN_DOMAIN "$DOMAIN"
    set_env OMNILEARN_FRONTEND_DOMAIN "$DOMAIN"

    # Public, browser-facing API origin + scheme. Without this the browser would
    # try to reach the internal 127.0.0.1:9000 and every fetch would fail.
    if [ "$NO_TLS" != "1" ] && [ -n "$EMAIL" ]; then
      set_env OMNILEARN_PUBLIC_URL "https://${DOMAIN}"
      set_env NEXT_PUBLIC_OMNILEARN_HTTPS true
      set_env NEXT_PUBLIC_COLLAB_URL "wss://${DOMAIN}/collab"
    else
      set_env OMNILEARN_PUBLIC_URL "http://${DOMAIN}"
      set_env NEXT_PUBLIC_OMNILEARN_HTTPS false
      set_env NEXT_PUBLIC_COLLAB_URL "ws://${DOMAIN}/collab"
    fi
    info "Domain set to ${DOMAIN} (public URL: $(grep -E '^OMNILEARN_PUBLIC_URL=' "$ENV_FILE" | cut -d= -f2-))"
  else
    warn "No --domain given; leaving OMNILEARN_DOMAIN as-is (IP/localhost)."
  fi

  chmod 600 "$ENV_FILE"
  info "Secrets in place; .env locked to 0600."
}

# ═══════════════════════════════════════════════════════════════════════════
# 4. Build & start the container stack
# ═══════════════════════════════════════════════════════════════════════════
compose() { docker compose "$@"; }

deploy_stack() {
  step "Building and starting the stack (db + redis + app)"
  compose pull db redis >/dev/null 2>&1 || true
  compose up -d --build
  info "Containers launched."
}

wait_for_health() {
  step "Waiting for the app to become healthy"
  local port url i
  port="$(grep -E '^HTTP_PORT=' "$ENV_FILE" | cut -d= -f2)"; port="${port:-8080}"
  url="http://127.0.0.1:${port}/api/v1/health"
  for i in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      info "Health check passed (${url})."
      return 0
    fi
    sleep 5
  done
  warn "App did not report healthy within ~5 min. Check: docker compose logs -f app"
  return 1
}

# ═══════════════════════════════════════════════════════════════════════════
# 5. Host nginx reverse proxy + TLS
# ═══════════════════════════════════════════════════════════════════════════
configure_nginx() {
  [ "$NO_NGINX" = "1" ] && { info "--no-nginx: skipping host reverse proxy."; return; }
  [ -z "$DOMAIN" ] && { warn "No --domain: skipping host nginx (container port is exposed directly)."; return; }

  step "Configuring host nginx reverse proxy for ${DOMAIN}"
  local port avail enabled
  port="$(grep -E '^HTTP_PORT=' "$ENV_FILE" | cut -d= -f2)"; port="${port:-8080}"
  avail="/etc/nginx/sites-available/${NGINX_SITE_NAME}"
  enabled="/etc/nginx/sites-enabled/${NGINX_SITE_NAME}"

  sed -e "s/__DOMAIN__/${DOMAIN}/g" -e "s/__HTTP_PORT__/${port}/g" \
    "$NGINX_TEMPLATE" > "$avail"
  ln -sf "$avail" "$enabled"
  [ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default

  nginx -t || die "nginx config test failed."
  systemctl reload nginx || systemctl restart nginx
  info "Reverse proxy live: ${DOMAIN} → 127.0.0.1:${port}"
}

setup_tls() {
  [ "$NO_NGINX" = "1" ] && return 0
  [ "$NO_TLS" = "1" ] && { warn "--no-tls: serving plain HTTP only."; return 0; }
  [ -z "$DOMAIN" ] && return 0
  [ -z "$EMAIL" ] && { warn "No --email: skipping TLS. Re-run with --email to enable HTTPS."; return 0; }

  step "Obtaining/renewing TLS certificate for ${DOMAIN}"
  if certbot --nginx -d "$DOMAIN" \
       --non-interactive --agree-tos -m "$EMAIL" --redirect; then
    info "HTTPS enabled and auto-renewal scheduled by certbot."
  else
    warn "certbot failed (DNS not pointing here yet?). Site still serves HTTP."
    warn "Fix DNS, then re-run: sudo certbot --nginx -d ${DOMAIN} -m ${EMAIL} --agree-tos --redirect"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════
summary() {
  local port scheme host
  port="$(grep -E '^HTTP_PORT=' "$ENV_FILE" | cut -d= -f2)"; port="${port:-8080}"
  step "Deployment complete"
  if [ -n "$DOMAIN" ] && [ "$NO_NGINX" != "1" ]; then
    scheme="http"; [ "$NO_TLS" != "1" ] && [ -n "$EMAIL" ] && scheme="https"
    host="${scheme}://${DOMAIN}"
  else
    host="http://<droplet-ip>:${port}"
  fi
  cat <<EOF

  URL:            ${host}
  Admin email:    $(grep -E '^OMNILEARN_INITIAL_ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2-)
  Admin password: $(grep -E '^OMNILEARN_INITIAL_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)

  Handy commands:
    docker compose ps            # status
    docker compose logs -f app   # app logs
    docker compose restart app   # restart app
    sudo ./deploy/deploy.sh --update   # redeploy after 'git pull'

EOF
  [ "$(grep -E '^OMNILEARN_INITIAL_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)" = "change-me" ] \
    && warn "Change OMNILEARN_INITIAL_ADMIN_PASSWORD in .env before going live."
  return 0
}

main() {
  require_root
  command -v openssl >/dev/null 2>&1 || { apt-get update -y && apt-get install -y openssl; }
  install_system_deps
  prepare_env
  configure_firewall
  deploy_stack
  configure_nginx
  setup_tls
  wait_for_health || true
  summary
}

main "$@"
