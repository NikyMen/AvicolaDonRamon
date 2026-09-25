# 🔌 API Avícola Don Ramón — Referencia para n8n

API REST para que el **bot de consultoría digital en n8n** consuma el catálogo,
tome pedidos y gestione clientes.

- **Base URL:** `https://TU_DOMINIO/api/v1` (local: `http://localhost:3000/api/v1`)
- **Formato:** JSON. Respuestas exitosas → `{ "data": ... }`. Errores → `{ "error": { "message", "code" } }`.
- **Autenticación:** todas las rutas (excepto `/health`) requieren la API key:

  ```
  Authorization: Bearer TU_API_KEY
  ```
  (También se acepta el header `x-api-key: TU_API_KEY`.)

  > Si la variable de entorno `API_KEY` no está configurada, la API queda abierta (solo para desarrollo).

## Configuración en n8n

1. Creá una credencial **Header Auth**:
   - Name: `Authorization`
   - Value: `Bearer TU_API_KEY`
2. Usá el nodo **HTTP Request** apuntando a la Base URL y eligiendo esa credencial.

---

## Endpoints

### Salud (público)
```
GET /health
```
```json
{ "status": "ok", "service": "avicola-don-ramon-api", "version": "v1", "database": "ok", "time": "..." }
```

### Catálogo

```
GET /products
GET /products?category=combos&available=true&search=pollo
GET /products/:id
GET /offers
GET /categories
```
`category`: `pollos | combos | guarniciones | bebidas | postres`

Ejemplo de producto:
```json
{ "id": "p-pollo-entero", "name": "Pollo Entero", "description": "...", "price": 12500,
  "category": "pollos", "image": "https://...", "badge": "Más vendido", "available": true }
```

### Pedidos

```
GET  /orders?status=pendiente&customerId=...&limit=50
GET  /orders/:id            (id = código tipo "#1042")
POST /orders
PATCH /orders/:id           (cambiar estado)
```

**Crear pedido** — el total se calcula en el servidor a partir de los precios reales.
Si el cliente no existe, se crea/actualiza automáticamente por teléfono.
```json
POST /orders
{
  "customer": { "name": "Juan Pérez", "phone": "+54 343 5550101", "email": "juan@mail.com" },
  "items": [
    { "productId": "p-pollo-entero", "qty": 1 },
    { "productId": "p-papas", "qty": 2 }
  ],
  "payment": "mercadopago",
  "address": "Av. Siempreviva 742",
  "deliverySlot": "08-12",
  "deliveryDate": "2026-08-03",
  "notes": "Sin sal"
}
```
> Alternativamente, en lugar de `customer` podés mandar `customerId` de un cliente existente.
> `deliverySlot` es el rango horario de entrega: `08-12` (08:00 a 12:00) o `17-20` (17:00 a 20:00).
> `deliveryDate` es la fecha calendario estimada en Argentina (`YYYY-MM-DD`).
> El stock se descuenta al crear el pedido: si no alcanza, la respuesta es `400` con el detalle.

Respuesta (`201`):
```json
{ "data": { "id": "#1043", "customer": "Juan Pérez", "items": [...], "total": 19500,
  "status": "pendiente", "payment": "mercadopago", "date": "..." } }
```

**Cambiar estado:**
```json
PATCH /orders/#1043
{ "status": "en_camino" }
```
Estados válidos: `pendiente | en_preparacion | en_camino | entregado | cancelado`
Pagos válidos: `efectivo | tarjeta | mercadopago | transferencia`

### Clientes

```
GET  /customers?search=juan
GET  /customers?phone=+54%20343%205550101     (búsqueda exacta -> devuelve 1 cliente o null)
GET  /customers?email=juan@mail.com
GET  /customers/:id
POST /customers
```
```json
POST /customers
{ "name": "Juan Pérez", "phone": "+54 343 5550101", "email": "juan@mail.com" }
```
Ejemplo de cliente:
```json
{ "id": "c-1", "name": "Martín Gómez", "email": "...", "phone": "...",
  "orders": 28, "spent": 312500, "joined": "..." }
```

### Contexto del asistente de WhatsApp

```http
POST /assistant/context
Authorization: Bearer TU_API_KEY
Content-Type: application/json

{
  "phone": "+54 9 343 400 0000",
  "name": "María",
  "leadId": "123456",
  "contactId": "654321",
  "commercialCondition": "Cuenta corriente",
  "commercialConditionKnown": true
}
```

`contactId`, `commercialCondition` y `commercialConditionKnown` son opcionales y vienen del
contacto de Kommo. Si `commercialCondition` trae un valor se guarda; si llega vacío con
`commercialConditionKnown: true` se guarda "Sin definir"; si Kommo no respondió
(`commercialConditionKnown` ausente o `false`) se conserva la condición guardada.

Cuando la condición es **Cuenta corriente**, `business.products` trae la **lista mayorista**
(con `inStock` y `priceList: "mayorista"`), `offers` queda vacío y `superOffer` en `null`.

El endpoint normaliza el teléfono, crea o actualiza el contacto y devuelve el estado del
asistente junto con conocimiento activo, catálogo, ofertas, sucursales y reglas de entrega.
No devuelve notas internas ni guarda conversaciones.

```json
{
  "data": {
    "assistant": {
      "enabled": true,
      "pausedForPhone": false,
      "shouldReply": true
    },
    "contact": {
      "id": "...",
      "phone": "3794000000",
      "name": "María",
      "commercialCondition": "Cuenta corriente",
      "cuentaCorriente": true,
      "lastSeenAt": "2026-08-24T20:00:00.000Z"
    },
    "pricing": {
      "priceList": "mayorista",
      "commercialCondition": "Cuenta corriente",
      "instruction": "Cliente en cuenta corriente: usá únicamente los precios de la lista mayorista..."
    },
    "knowledge": [],
    "business": {
      "priceList": "mayorista",
      "products": [],
      "offers": [],
      "superOffer": null,
      "branches": [],
      "delivery": {},
      "checkout": {}
    }
  }
}
```

En n8n continuá al modelo únicamente cuando `{{$json.data.assistant.shouldReply}}` sea `true`.
Si es `false`, finalizá el flujo sin enviar un mensaje automático.

### Lista mayorista

```http
GET  /wholesale/products?available=true
POST /wholesale/products
Authorization: Bearer TU_API_KEY
Content-Type: application/json

{
  "items": [
    { "code": "R15", "name": "Caja pata muslo Resistire", "description": "x15 kg", "category": "Cajones", "price": 33000, "stock": null }
  ]
}
```

`POST` da de alta o actualiza en bloque (hasta 5000 filas, todo o nada). Empareja por `code`
y, si la fila no trae código, por nombre. `stock: null` significa "sin control de stock"; si
`stock` no se envía, se conserva el actual. Responde `{ "data": { "created": 1, "updated": 0 } }`.
La lista mayorista nunca aparece en endpoints públicos.

### Webhook de Kommo (condición comercial)

```http
POST /kommo/webhook?secret=KOMMO_WEBHOOK_SECRET
Content-Type: application/x-www-form-urlencoded
```

Lo llama Kommo (evento "Contacto modificado"), no n8n. Copia el campo "Condición comercial" del
contacto al contacto de WhatsApp vinculado (por ID de contacto de Kommo o, si todavía no está
vinculado, por teléfono). Ver [cuenta-corriente-kommo.md](cuenta-corriente-kommo.md).

Para el workflow comercial de solo lectura también está disponible:

```http
GET /assistant/catalog
```

Devuelve catálogo, stock, ofertas, dirección, horarios, checkout y envío fijo de $2.000.
No expone contactos, notas ni conocimiento interno.

---

## Códigos de error

| Código HTTP | `code` | Significado |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | API key ausente o inválida |
| 404 | `NOT_FOUND` | Recurso no encontrado |
| 422 | `VALIDATION_ERROR` | Body inválido (incluye `issues[]`) |
| 400 | `BAD_REQUEST` | Error de negocio (ej. producto sin stock) |
| 409 | `DB_CONFLICT` | Conflicto de unicidad |
| 503 | `NO_DATABASE` / `DB_UNAVAILABLE` | Base de datos no configurada o caída |

## Ejemplos curl

```bash
# Catálogo
curl -H "Authorization: Bearer $API_KEY" https://TU_DOMINIO/api/v1/products

# Crear pedido
curl -X POST https://TU_DOMINIO/api/v1/orders \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"customer":{"name":"Juan","phone":"+54343555"},"items":[{"productId":"p-pollo-entero","qty":1}],"payment":"efectivo"}'

# Estado de un pedido
curl -H "Authorization: Bearer $API_KEY" "https://TU_DOMINIO/api/v1/orders/%231043"

# Buscar cliente por teléfono
curl -H "Authorization: Bearer $API_KEY" "https://TU_DOMINIO/api/v1/customers?phone=+54343555"
```
