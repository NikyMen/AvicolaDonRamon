# OTP WhatsApp con n8n

## Backend

La web pide códigos por:

```http
POST /api/auth/request-otp
Content-Type: application/json

{ "phone": "+5491111111111" }
```

El backend genera un código de 4 dígitos, lo guarda hasheado por 5 minutos y llama al webhook configurado en:

```env
OTP_WHATSAPP_WEBHOOK_URL="https://n8n.srv1224751.hstgr.cloud/webhook/codigo-polleria-web"
OTP_LOG_CODE=""
```

El login se completa con:

```http
POST /api/auth/verify-otp
Content-Type: application/json

{ "phone": "+5491111111111", "code": "1234", "name": "Cliente" }
```

`OTP_LOG_CODE=true` es solo para pruebas: imprime el código en consola aunque se mande por WhatsApp. En producción dejalo vacío.

## Payload enviado a n8n

El webhook recibe:

```json
{
  "phone": "+5491111111111",
  "code": "1234",
  "message": "Tu código de acceso a Pollería Entre Ríos es 1234. Vence en 5 minutos. No lo compartas con nadie."
}
```

## Flujo n8n

1. `Webhook`
   - Method: `POST`
   - Path: `codigo-polleria-web`
   - Response: responder con `200` al final del flujo.

2. Nodo de WhatsApp
   - To: `{{$json.body.phone}}`
   - Message: `{{$json.body.message}}`

3. `Respond to Webhook`
   - Status: `200`
   - Body:

```json
{ "ok": true }
```

Importante: para producción usá `/webhook/codigo-polleria-web` con el workflow activo. Para pruebas puntuales en n8n podés cambiar temporalmente a `/webhook-test/codigo-polleria-web`.
