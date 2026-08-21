# Seguimiento de pedidos por WhatsApp con n8n

La web avisa a n8n cada vez que un pedido cambia de estado. Con esos eventos
armás el flujo de mensajes al cliente y la ruta optimizada del repartidor.

## 1. Variables de entorno (lado web)

| Variable | Qué hace |
| --- | --- |
| `N8N_ORDER_WEBHOOK_URL` | URL del webhook de n8n que recibe los eventos de pedido. |
| `N8N_ORDER_DISPATCH_WEBHOOK_URL` | (Opcional) Webhook exclusivo para `pedido_en_camino`, disparado al cerrar el lote. Si queda vacío usa el general. |
| `N8N_ORDER_DELIVERED_WEBHOOK_URL` | Webhook exclusivo para `pedido_entregado`. Si queda vacío usa `https://n8n.srv1224751.hstgr.cloud/webhook/pedido-entregado`. |
| `N8N_DELIVERY_CANCEL_WEBHOOK_URL` | Webhook exclusivo para `pedido_reasignado`, al devolver una entrega para asignarla a otro repartidor. |
| `N8N_ORDER_WEBHOOK_SECRET` | (Opcional) La web manda `Authorization: Bearer <valor>`; validalo en n8n. |
| `MP_ACCESS_TOKEN` | Access token de Mercado Pago (Checkout Pro). |
| `MP_WEBHOOK_SECRET` | Firma secreta de Webhooks de Mercado Pago; permite rechazar notificaciones falsas. |
| `NEXT_PUBLIC_BASE_URL` | URL pública del sitio; necesaria para que MP llame al webhook de pagos. |
| `API_KEY` | La que ya usa tu bot para llamar a `/api/v1/...` (Authorization: Bearer). |

## 2. Qué manda la web (webhook de salida)

`POST N8N_ORDER_WEBHOOK_URL` con JSON:

```json
{
  "event": "pedido_en_camino",
  "at": "2026-07-03T14:05:00.000Z",
  "message": "🚚 Tu pedido está saliendo de la sucursal.\n🔐 Este es tu código: 4821. Debés dárselo al repartidor cuando te entregue tu pedido.",
  "mensaje": "🚚 Tu pedido está saliendo de la sucursal.\n🔐 Este es tu código: 4821. Debés dárselo al repartidor cuando te entregue tu pedido.",
  "order": {
    "id": "#1042",
    "internalId": "cmc...",
    "customer": "Juan Pérez",
    "phone": "3794123456",
    "address": "Av. Libertad 1234",
    "entrega": "envio",
    "lat": -27.4712,
    "lng": -58.8244,
    "deliveryCode": "4821",
    "total": 215000,
    "status": "en_camino",
    "payment": "mercadopago",
    "items": [{ "productId": "patamuslo-10kg", "name": "Caja Patamuslo 10kg", "qty": 1, "price": 215000 }],
    "date": "2026-07-03T13:40:00.000Z"
  }
}
```

Eventos posibles:

| Evento | Cuándo se dispara | Mensaje sugerido al cliente |
| --- | --- | --- |
| `pedido_confirmado` | El pago de MP fue aprobado (estado `en_preparacion`). | "✅ ¡Recibimos tu pago! Ya estamos preparando tu pedido `{{id}}`." |
| `pedido_en_camino` | El panel cierra el lote (o el bot vía API pasa a `en_camino`). | "🚚 Tu pedido está saliendo de la sucursal.\n🔐 Este es tu código: *{{deliveryCode}}*. Debés dárselo al repartidor cuando te entregue tu pedido." |
| `pedido_entregado` | El repartidor validó el código de entrega. | "🙌 ¡Gracias por tu compra! Tu pedido `{{id}}` fue entregado." |
| `pedido_cancelado` | Pago rechazado o cancelación manual. | "❌ Tu pedido fue cancelado. Escribinos si querés reintentarlo." |
| `pedido_reasignado` | Una entrega vuelve al panel para asignarla a otro repartidor. | "Tu pedido fue reasignado. Disculpe las molestias. Nuestro equipo ya se comunicará con usted." |

> **La ruta ya la arma la web.** Desde `/admin/entregas`, el botón "Cerrar
> pedidos para enviar" optimiza el recorrido, pasa los envíos a `en_camino` y
> dispara `pedido_en_camino` a todos, incluyendo el código de entrega. El
> repartidor entra a la página móvil `/reparto` con su usuario y contraseña
> (creados en /admin/equipo con rol "repartidor") y ve solo su ruta asignada,
> donde ingresa el código de cada cliente. En n8n sólo necesitás el **Flujo B** (mandar el
> WhatsApp según el evento). Los Flujos A y C de abajo quedan como alternativa
> si preferís manejar la ruta desde el bot.

## 3. Endpoints que puede llamar tu bot (con `Authorization: Bearer API_KEY`)

- `GET /api/v1/orders?status=en_preparacion` — pedidos listos para armar la ruta.
- `PATCH /api/v1/orders/:id` con `{ "status": "en_camino" }` — marcar que salió
  del local (dispara `pedido_en_camino`).
- `POST /api/v1/orders/:id/deliver` con `{ "code": "4821" }` — el repartidor
  ingresa el código que le dio el cliente. Si es correcto el pedido pasa a
  `entregado` y se dispara `pedido_entregado`. Errores: `INVALID_CODE`,
  `ALREADY_DELIVERED`, `NO_CODE`, `NOT_FOUND`.

## 4. Flujo n8n sugerido

**Flujo A — Armar la ruta (cuando el repartidor sale):**
1. Trigger manual o desde tu bot de WhatsApp ("salgo con los pedidos").
2. `HTTP Request` → `GET /api/v1/orders?status=en_preparacion`.
3. `Code node`: ordenar las paradas con vecino más cercano usando `lat`/`lng`
   de cada pedido (arrancando desde la sucursal). Guardá la lista ordenada en
   una tabla propia de n8n (Data Store / Google Sheets / variable de flujo).
4. Por cada pedido: `PATCH /api/v1/orders/:id` → `en_camino`.
5. Armá el link de ruta para el repartidor:
   `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&waypoints=LAT1,LNG1|LAT2,LNG2`
   y mandáselo por WhatsApp.

**Flujo B — Webhook de eventos (el que configura `N8N_ORDER_WEBHOOK_URL`):**
1. `Webhook node` (POST). Si definiste `N8N_ORDER_WEBHOOK_SECRET`, validá el
   header `Authorization`.
2. `Switch` por `{{$json.event}}`:
   - `pedido_confirmado` → WhatsApp al cliente (`order.phone`): pago recibido.
   - `pedido_en_camino` → WhatsApp al cliente con el **código de entrega**
     (`order.deliveryCode`) y aviso de que salió el pedido.
   - `pedido_entregado` → (opcional) agradecimiento al cliente.
   - `pedido_cancelado` → aviso de cancelación.

**Flujo C — El repartidor entrega:**
1. El repartidor le pide el código al cliente y se lo manda a tu bot
   ("entregado 1042 4821" o como prefieras).
2. El bot llama `POST /api/v1/orders/#1042/deliver` con `{ "code": "4821" }`.
3. Si responde OK, la web dispara `pedido_entregado` → el Flujo B puede enviar
   un agradecimiento al cliente.

> Nota: el `deliveryCode` solo existe en pedidos con `entrega: "envio"`.
> Los retiros en sucursal no lo llevan.
