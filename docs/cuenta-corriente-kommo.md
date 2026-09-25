# Cuenta corriente, lista mayorista y sincronización con Kommo

## Qué hace

- **Stock mayorista** (`/admin/mayorista`): lista de precios aparte del catálogo minorista.
  Se carga a mano, pegando filas desde Excel o por API (`POST /api/v1/wholesale/products`).
  El stock es opcional: vacío = "sin control" (se ofrece mientras esté disponible).
- **Asistente WhatsApp** (`/admin/asistente`): cada contacto muestra su condición comercial y
  un botón **Activar cuenta corriente** / **Quitar cuenta corriente**.
- **Asistente**: si el contacto está en cuenta corriente, la web le pasa a n8n la lista
  mayorista en lugar del catálogo minorista (sin ofertas ni superoferta). Si el producto no
  está en la lista mayorista, el bot deriva a una persona en vez de dar el precio minorista.

## Sincronización

Kommo es la fuente de verdad del campo **Condición comercial** del contacto.

| Cambio hecho en | Cómo llega al otro lado |
| --- | --- |
| Web (botón) | La web escribe primero en Kommo y recién después guarda. Si Kommo falla, no cambia nada y el panel muestra el error. |
| Kommo | Al instante por el webhook de Kommo. Además, en cada mensaje n8n lee el contacto y se lo manda a la web. |

- Activar pone **Cuenta corriente**; quitar pone **Sin definir** (en Kommo y en la web).
- El botón necesita que el contacto esté vinculado a Kommo (tener Lead ID). Los contactos se
  vinculan solos cuando escriben por WhatsApp.
- Si n8n no pudo leer el contacto de Kommo, la web conserva la condición que ya tenía: un error
  de Kommo no saca a nadie de cuenta corriente.

## Puesta en marcha

### 1. Servidor

Agregá al `.env` del servidor (ver `.env.example`):

```bash
KOMMO_BASE_URL="https://contactoavicoladonramoncomar.kommo.com"
KOMMO_ACCESS_TOKEN="<token de larga duración, el mismo de la credencial AvicolaDonRamonKommo de n8n>"
KOMMO_WEBHOOK_SECRET="<openssl rand -hex 32>"
```

Después, como en cada despliegue:

```bash
pnpm install --frozen-lockfile
pnpm run db:migrate
pnpm build
pm2 startOrReload ecosystem.config.cjs --update-env
```

### 2. Webhook en Kommo

Kommo → Configuración → Integraciones → **Web hooks** → agregar:

- URL: `https://avicoladonramon.consultoriadigital.io/api/v1/kommo/webhook?secret=<KOMMO_WEBHOOK_SECRET>`
- Eventos: **Contacto modificado** (y opcionalmente **Contacto agregado**).

### 3. n8n

Los nodos actualizados están en [features/cuenta-corriente/n8n](features/cuenta-corriente/n8n).
Cada `.json` se pega directo en el lienzo (Ctrl+V). Para no duplicar nombres, borrá antes el
nodo viejo y después reconectá igual que estaba. En los nodos de código también podés abrir el
nodo y reemplazar todo el código por el del `.js`.

| Nodo | Archivo | Cambio |
| --- | --- | --- |
| Preparar contexto Don Ramon | `Preparar-contexto-Don-Ramon.json` / `.js` | Agrega `contactId` y `commercialConditionKnown`. |
| Contexto web Don Ramon1 | `Contexto-web-Don-Ramon.json` | Envía `contactId`, `commercialCondition` y `commercialConditionKnown`. |
| Preparar entrada IA Don Ramon | `Preparar-entrada-IA-Don-Ramon.json` / `.js` | Muestra `LISTA: MAYORISTA/MINORISTA`, omite ofertas en mayorista y resuelve stock "sin control". |
| AI Agent | `AI-Agent.json` o `AI-Agent-system-message.txt` | Sección nueva "CUENTA CORRIENTE (LISTA MAYORISTA)" y excepción en "LISTA DE PRECIOS" (sin drive minorista). |

Para el **AI Agent** lo más simple es abrir el nodo y reemplazar el *System Message* por el
contenido de `AI-Agent-system-message.txt`: así conserva sus conexiones con el modelo y la memoria.

Conexiones (sin cambios): `Resolver contacto` → `Buscar contacto` → `Preparar contexto` →
`Contexto web` → `Responder Don Ramon` → `If row exists` → `Preparar entrada IA` → `AI Agent`.

## Prueba sugerida

1. Cargar al menos un producto en **Stock mayorista**.
2. En **Asistente WhatsApp**, tocar **Activar cuenta corriente** en un contacto de prueba y
   comprobar en Kommo que su Condición comercial quedó en "Cuenta corriente".
3. Cambiarla en Kommo a otra opción y recargar el panel: debe verse el cambio.
4. Volver a ponerla en "Cuenta corriente" y escribir por WhatsApp preguntando por un producto de la
   lista mayorista (debe responder con ese precio) y por uno que no esté (debe derivar).

Pruebas locales sin red ni base: `node scripts/test-cuenta-corriente.mjs`.
