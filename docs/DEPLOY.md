# Deploy en el VPS (Hostinger, Docker)

La app corre con `docker compose`: un contenedor `web` (Next.js + Prisma) y uno `db` (PostgreSQL 16 con volumen persistente). El entrypoint aplica el esquema de Prisma (`prisma db push`) en cada arranque, así que no hay pasos manuales de migración.

## Primera vez

1. **Entrar al VPS** (Terminal del panel de Hostinger o SSH):

   ```bash
   ssh root@srv1224751.hstgr.cloud
   ```

2. **Clonar el repo:**

   ```bash
   cd /opt
   git clone <URL-DEL-REPO> polleria-web
   cd polleria-web
   ```

3. **Crear el `.env` de producción:**

   ```bash
   cp .env.example .env
   nano .env
   ```

   Completar obligatoriamente (generar claves con `openssl rand -hex 32`):

   | Variable | Valor |
   |---|---|
   | `API_KEY` | clave aleatoria larga (la usa el bot de n8n) |
   | `SESSION_SECRET` | clave aleatoria larga |
   | `ADMIN_PASSWORD` | contraseña fuerte del panel `/admin` |
   | `POSTGRES_PASSWORD` | contraseña fuerte de la base |
   | `OTP_WHATSAPP_WEBHOOK_URL` | webhook de n8n que envía el OTP |
   | `ADMIN_PHONES` | teléfonos con acceso admin |

   `DATABASE_URL` del `.env` se ignora en Docker: el compose la arma solo apuntando al contenedor `db`.

4. **Levantar:**

   ```bash
   docker compose up -d --build
   ```

5. **Verificar:**

   ```bash
   docker compose ps                      # ambos "healthy"
   docker compose logs -f web            # logs de la app
   curl http://localhost:3000/api/v1/health
   ```

## Conectar el bot de n8n

Para que n8n (que corre en otro proyecto de Docker) llegue a la API sin salir del VPS, conectar el contenedor de n8n a la red de este compose:

```bash
docker network connect polleria-web_default n8n-n8n-1
```

Después, en n8n usar como base URL `http://polleria-web:3000` con header `Authorization: Bearer <API_KEY>`.

(Alternativa sin tocar redes: usar `http://IP-DEL-VPS:3000`.)

## Actualizar (cada deploy)

```bash
cd /opt/polleria-web
git pull
docker compose up -d --build
```

Los datos de PostgreSQL viven en el volumen `pgdata` y sobreviven a rebuilds. Para limpiar imágenes viejas de vez en cuando: `docker image prune -f`.

Si cambiaste `ADMIN_USER` o `ADMIN_PASSWORD`, el `.env` no se actualiza con
`git pull` porque no se versiona. Editalo en el VPS y forzá la recreación del
contenedor web para que tome las credenciales nuevas:

```bash
cd /opt/polleria-web
nano .env
docker compose up -d --build --force-recreate web
docker compose ps
curl -f http://localhost:3000/api/v1/health
```

Si la contraseña anterior pudo quedar expuesta, cambiá también
`SESSION_SECRET`: eso cierra las sesiones administrativas que ya estaban abiertas.

## Comandos útiles

```bash
docker compose logs -f web        # logs en vivo
docker compose restart web        # reiniciar solo la app
docker compose exec web pnpm exec prisma studio   # inspeccionar la DB (puerto 5555)
docker compose exec web pnpm run db:seed          # cargar datos de ejemplo
docker compose down               # apagar (NO borra datos)
docker compose down -v            # ⚠️ apaga Y BORRA la base de datos
```
