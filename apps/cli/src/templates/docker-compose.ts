import { APP_IMAGE, POSTGRES_IMAGE, POSTGRES_AI_IMAGE } from '../constants.js'
import type { SetupConfig } from '../types.js'

/**
 * Generates docker-compose.yml with unique deployment ID.
 * External database/redis excluded. Auto SSL uses Caddy instead of nginx.
 */
export function generateDockerCompose(config: SetupConfig, appImage?: string): string {
  const image = appImage || APP_IMAGE
  const id = config.deploymentId
  const useLocalDb = !config.useExternalDb
  const useLocalRedis = !config.useExternalRedis

  const deps: string[] = []
  if (useLocalDb) deps.push('      db:\n        condition: service_healthy')
  if (useLocalRedis) deps.push('      redis:\n        condition: service_healthy')

  const appDependsOn = deps.length > 0
    ? `    depends_on:\n${deps.join('\n')}`
    : ''

  const proxyService = config.autoSsl
    ? `
  caddy:
    image: caddy:2-alpine
    container_name: omnilearn-caddy-${id}
    restart: unless-stopped
    ports:
      - "80:80"
      - "\${HTTP_PORT:-443}:443"
    volumes:
      - ./extra/Caddyfile:/etc/caddy/Caddyfile:ro
      - omnilearn_caddy_data_${id}:/data
      - omnilearn_caddy_config_${id}:/config
    depends_on:
      omnilearn-app:
        condition: service_healthy
    networks:
      - omnilearn-network-${id}
    healthcheck:
      # Use 127.0.0.1 — alpine's wget tries IPv6 first and Caddy only binds v4 by default
      test: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://127.0.0.1:80/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
`
    : `
  nginx:
    image: nginx:alpine
    container_name: omnilearn-nginx-${id}
    restart: unless-stopped
    ports:
      - "\${HTTP_PORT:-80}:80"
    volumes:
      - ./extra/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      omnilearn-app:
        condition: service_healthy
    networks:
      - omnilearn-network-${id}
    healthcheck:
      # Use 127.0.0.1 — alpine's wget resolves localhost to IPv6 first, but nginx only listens on v4 by default
      test: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
`

  // Sidecar forwards localhost:${HTTP_PORT} → localhost:80 inside the app
  // container so SSR fetches reach the internal nginx on non-80 deployments.
  const needsSsrPortForward = !config.autoSsl && !config.useHttps && config.httpPort !== 80
  const ssrForwardService = needsSsrPortForward
    ? `
  ssr-fwd:
    image: alpine/socat:1.8.0.0
    container_name: omnilearn-ssr-fwd-${id}
    restart: unless-stopped
    network_mode: "service:omnilearn-app"
    command: TCP-LISTEN:${config.httpPort},fork,reuseaddr TCP:localhost:80
    depends_on:
      omnilearn-app:
        condition: service_healthy
`
    : ''

  const dbImage = config.useAiDatabase ? POSTGRES_AI_IMAGE : POSTGRES_IMAGE
  const dbService = useLocalDb
    ? `
  db:
    image: ${dbImage}
    container_name: omnilearn-db-${id}
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - POSTGRES_USER=\${POSTGRES_USER:-omnilearn}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD:-omnilearn}
      - POSTGRES_DB=\${POSTGRES_DB:-omnilearn}
    volumes:
      - omnilearn_db_data_${id}:/var/lib/postgresql/data
    networks:
      - omnilearn-network-${id}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-omnilearn}"]
      interval: 5s
      timeout: 4s
      retries: 5
`
    : ''

  const redisService = useLocalRedis
    ? `
  redis:
    image: redis:7.2.3-alpine
    container_name: omnilearn-redis-${id}
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - omnilearn_redis_data_${id}:/data
    networks:
      - omnilearn-network-${id}
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 4s
      retries: 5
`
    : ''

  const useLocalContent = !config.s3Enabled
  const appVolumes = useLocalContent
    ? `    volumes:\n      - omnilearn_content_${id}:/app/api/content\n`
    : ''

  const volumeEntries: string[] = []
  if (config.autoSsl) {
    volumeEntries.push(`  omnilearn_caddy_data_${id}:`)
    volumeEntries.push(`  omnilearn_caddy_config_${id}:`)
  }
  if (useLocalDb) volumeEntries.push(`  omnilearn_db_data_${id}:`)
  if (useLocalRedis) volumeEntries.push(`  omnilearn_redis_data_${id}:`)
  if (useLocalContent) volumeEntries.push(`  omnilearn_content_${id}:`)

  const volumesSection = volumeEntries.length > 0
    ? `volumes:\n${volumeEntries.join('\n')}`
    : ''

  return `name: omnilearn-${id}

services:
  omnilearn-app:
    image: ${image}
    container_name: omnilearn-app-${id}
    restart: unless-stopped
    env_file:
      - .env
    environment:
      # HOSTNAME needs to be set explicitly for the container
      - HOSTNAME=0.0.0.0
      - OMNILEARN_API_URL=http://localhost:9000
${appVolumes}${appDependsOn}
    networks:
      - omnilearn-network-${id}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
${proxyService}${ssrForwardService}${dbService}${redisService}
networks:
  omnilearn-network-${id}:
    driver: bridge${config.dockerIpv6 ? '\n    enable_ipv6: true' : ''}

${volumesSection}
`
}
