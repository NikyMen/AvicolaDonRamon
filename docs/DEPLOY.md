# Deploy de Avícola Don Ramón en VPS con PM2

La aplicación corre con Next.js bajo PM2 y usa PostgreSQL mediante `DATABASE_URL`.
La ruta sugerida es `/opt/avicola-don-ramon` y el proceso se llama `avicola-don-ramon`.

## Primera instalación

```bash
cd /opt
git clone https://github.com/NikyMen/AvicolaDonRamon.git avicola-don-ramon
cd /opt/avicola-don-ramon

corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm install --frozen-lockfile

cp .env.example .env
nano .env
```

Completá como mínimo `DATABASE_URL`, `API_KEY`, `SESSION_SECRET`,
`ADMIN_PASSWORD`, `ADMIN_PHONES`, `NEXT_PUBLIC_BASE_URL` y las integraciones que uses.

```bash
pnpm run db:migrate
pnpm build

# Solo si PM2 todavía no está instalado:
pnpm add --global pm2

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Ejecutá también el comando que muestre `pm2 startup`; ese paso habilita el arranque
automático después de reiniciar el VPS.

## Actualizar producción

```bash
cd /opt/avicola-don-ramon
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm run db:migrate
pnpm build
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
curl -f http://127.0.0.1:3000/api/v1/health
```

Si el proyecto ya está en otra carpeta, conservá esa ruta y ejecutá los mismos comandos allí.

## Comandos útiles

```bash
pm2 status
pm2 logs avicola-don-ramon --lines 100
pm2 restart avicola-don-ramon --update-env
pm2 describe avicola-don-ramon
```

Si modificaste `.env`, usá siempre `--update-env` al reiniciar.

## Nginx

```nginx
server {
    server_name TU_DOMINIO;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

En n8n configurá `AVICOLA_WEB_API_URL` con la URL pública HTTPS, sin barra final.

## Docker (alternativa)

Los archivos Docker se conservan para instalaciones que lo necesiten, pero no forman
parte del despliegue PM2:

```bash
docker compose up -d --build
```
