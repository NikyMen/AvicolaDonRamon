# Corrección de precios Cuántico en el VPS

El script afecta únicamente productos no archivados cuyo ID empieza con `cuantico-`.
Divide el precio actual y el precio anterior por el divisor indicado en la línea de
comandos (`--divisor=1000` quita tres ceros), redondeando a pesos enteros como el
modelo existente. No modifica pedidos históricos ni la superoferta independiente.

Dos filtros dejan fuera a los productos que ya están bien, para poder corregir la
mayoría sin romper el resto:

- Los productos con precio cero (por ejemplo, VARIOS) se omiten sin modificarlos y
  quedan registrados en `skippedZeroPrice` dentro del respaldo.
- Los productos por debajo de `--min-precio` se omiten y quedan en `skippedBelowMin`.
  Por defecto el umbral es `divisor × 1000` (con `--divisor=1000`, un millón de pesos):
  ningún precio real del catálogo llega a esa cifra, así que solo entran al lote los
  que con seguridad tienen los ceros de más. Bajar el umbral solo después de revisar
  el listado de omitidos.

La vista previa igual debe revisarse producto por producto. Se pueden quitar filas de
`rows` en el respaldo para excluir productos, sin cambiar sus valores.

## Preparación

1. Subir a GitHub únicamente los archivos de esta corrección, sin incluir `.env` ni respaldos.
2. Pausar el workflow/cron que sincroniza cada hora y esperar que termine la ejecución activa.
3. En el VPS, entrar a la carpeta del proyecto (la documentada es `/opt/avicola-don-ramon`).
4. Ejecutar `git status --short`. Si hay modificaciones locales, preservarlas antes del pull.
5. Ejecutar los siguientes comandos uno por uno; detenerse ante cualquier error:

```bash
git pull --ff-only
pnpm install --frozen-lockfile
pnpm exec node scripts/test-cuantico-prices.mjs
pnpm build
pnpm exec node scripts/repair-cuantico-prices.mjs preview precios-respaldo.json --divisor=1000
```

La prueba requiere Node 22.13 o superior. El script de corrección carga las variables de producción con la misma precedencia de Next.js
(`.env.production.local`, `.env.local`, `.env.production`, `.env`, sin reemplazar
variables exportadas). El respaldo se crea con permisos privados y no se sobrescribe.
Contiene el listado completo de antes/después; la terminal muestra los primeros 20 y
el conteo de omitidos por precio cero y por quedar debajo del umbral.
Si no encuentra productos o los precios no corresponden, no continuar.
Para generar otra vista previa (por ejemplo con otro umbral) usar un archivo nuevo:
el respaldo nunca se sobrescribe.

## Aplicar

```bash
pnpm exec node scripts/repair-cuantico-prices.mjs apply precios-respaldo.json
```

Se aplica en una transacción: ante un conflicto se revierte el lote. Repetir `apply`
con el MISMO respaldo omite los ya corregidos; no generar otra vista previa para
volver a corregir el mismo lote. Mantener el respaldo fuera de GitHub.

## Configuración de la importación horaria

Comparar el precio bruto de un producto en la respuesta de Cuántico:

- Si el origen devuelve `3600000` y el precio real es `3600`, configurar divisor `1000`.
- Si devuelve `385000` y el precio real es `38500`, configurar divisor `10`.
- Si devuelve `38500` o `38500.0000`, configurar divisor `1`.
- Si hay escalas mezcladas, no activar un divisor global; mantener la sincronización
  pausada y revisar la fuente.

El divisor del importador debe coincidir con el usado en la corrección masiva: si se
corrige la base con `--divisor=1000` y el importador queda en `1`, la primera
sincronización vuelve a escribir los precios con los tres ceros (y antes de eso el
tope de variación bloquea el lote completo, que es lo que evita el desastre).

Editar el archivo de entorno efectivo en el VPS, sin duplicar variables:

```dotenv
CUANTICO_PRICE_DIVISOR=1000
CUANTICO_MAX_PRICE_CHANGE_PERCENT=35
```

El ejemplo usa 1000 SOLO si la fuente está confirmada x1000. La normalización siempre
parte del precio recibido, nunca del precio guardado. Cambios superiores al 35%
en cualquier precio existente bloquean todo el lote antes de escribir. Los nuevos
productos no tienen una referencia anterior: se valida rango positivo y escala,
pero no se puede verificar automáticamente su precio comercial.

```bash
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
```

Probar una ejecución de sincronización, inspeccionar su respuesta y comprobar
productos en la web y en una conversación nueva de WhatsApp. Activar la ejecución
horaria solo después de verificarlo. No configurar n8n para ignorar errores: una
validación bloqueada devuelve error HTTP con los primeros IDs afectados.

Esta validación protege las sincronizaciones que usan
`POST /api/integraciones/cuantico/productos`. Si n8n escribe directamente en
PostgreSQL u otro endpoint, debe pasar por este importador para quedar protegido.

## Revertir

Con la sincronización pausada:

```bash
pnpm exec node scripts/repair-cuantico-prices.mjs restore precios-respaldo.json
pm2 restart avicola-don-ramon
```

`restore` y `apply` no llevan opciones: usan el divisor y el umbral guardados en el
respaldo. Restaura únicamente si los precios coinciden con el plan; si hubo cambios posteriores
cancela el lote para no pisarlos. Revisar también el divisor antes de reactivar la sincronización.
