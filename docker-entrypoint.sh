#!/bin/sh
set -eu

required_env() {
  name="$1"
  if [ -z "$(printenv "$name" || true)" ]; then
    echo "❌ Falta la variable obligatoria de producción: $name" >&2
    exit 1
  fi
}

for name in DATABASE_URL API_KEY SESSION_SECRET ADMIN_USER ADMIN_PASSWORD MP_ACCESS_TOKEN NEXT_PUBLIC_BASE_URL OTP_WHATSAPP_WEBHOOK_URL; do
  required_env "$name"
done

case "${CHECKOUT_FAKE_PAYMENT:-}" in
  1|true|TRUE|on|ON)
    echo "❌ CHECKOUT_FAKE_PAYMENT no puede estar activo en producción." >&2
    exit 1
    ;;
esac

echo "⏳ Esperando a la base de datos y aplicando el esquema…"
# Aplica únicamente las migraciones versionadas en producción.
pnpm exec prisma migrate deploy

echo "🚀 Iniciando Pollería Entre Ríos…"
exec pnpm start
