# Integración de polleria-web

Origen: copia local D:/dev/polleria-web, main 813158d, más cambios sin commit de analítica, notificaciones y conteos. Base común: 5633e29. GitHub no estuvo accesible para verificar cambios posteriores.

## Funciones integradas

- Dashboard comercial con períodos hasta 60 días, accesible desde la pestaña Comercial de /admin. El dashboard de WhatsApp permanece en la pestaña inicial.
- Analítica con agregaciones SQL, pantalla de carga y exportación Excel de 10 hojas.
- Administración de sucursales y retiro en sucursal; sucursal inicial de Don Ramón en Paraná.
- Calendario por localidad, mapa desplegable y validación de cobertura en cliente y servidor. La localidad habilitada sigue siendo Paraná.
- Tarifa fija o por kilómetro y bonificaciones generales o de sábados. El modo inicial es fijo, por $2.000; revisar las bonificaciones guardadas al desplegar.
- Cupones con fechas, días, múltiples productos, descuentos de envío, reservas y permisos por rol.
- Notificaciones de entregas pendientes y stock bajo, respetando permisos.

Se preservan WhatsApp, conocimiento, OCR, Lead ID, archivado de productos, preferencias de módulos, marca, catálogo, acceso administrativo inicial y despliegue PM2. El archivado también desactiva cupones que incluyen al producto en una selección múltiple. Las API de WhatsApp consultan sucursales y tarifas actuales.

## Puesta en marcha

Usar pnpm 10.33.2:

```sh
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm db:migrate
pnpm build
```

Las migraciones nuevas crean Sucursal y agregan pricingMode/flatFee a DeliverySettings. No se ejecutaron contra una base de datos durante esta integración. Configurar DATABASE_URL antes de migrar.

No se importa la migración local huérfana 20260825120000_add_coupon_expiration: agrega expiresAt, un campo ausente del esquema y de la lógica de polleria-web. La vigencia integrada usa startsAt/endsAt de las migraciones históricas existentes.

## Verificación

```sh
pnpm exec tsc --noEmit --incremental false
pnpm exec prisma validate
pnpm exec node --conditions=react-server --import tsx scripts/test-integration.mjs
pnpm build
```

La prueba de integración utiliza dobles de Prisma y no conecta a PostgreSQL ni a servicios externos. Cubre tarifas, bonificaciones, cobertura, calendario, archivado y cupones. La validación real de migraciones, pagos y n8n requiere un entorno de prueba configurado.

## Reutilización

Estos cambios integran funciones en el repositorio actual; todavía no constituyen una configuración multinegocio. Al convertirlo en fuente central habrá que parametrizar marca, ubicación, catálogo inicial e integraciones. La configuración regional está en src/lib/geo.ts y la sucursal inicial en src/lib/sucursales.ts y su migración. No se copiaron archivos .env ni credenciales.

Para que un clon desde GitHub contenga la integración, primero hay que confirmar y subir los cambios.
