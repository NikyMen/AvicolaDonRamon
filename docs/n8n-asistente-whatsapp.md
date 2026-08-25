# Asistente inteligente de WhatsApp con n8n

## Consulta de contexto

Antes de generar cada respuesta, agregá un nodo **HTTP Request**:

- Método: `POST`
- URL: `https://TU_DOMINIO/api/v1/assistant/context`
- Autenticación: Header `Authorization: Bearer TU_API_KEY`
- Body JSON:

```json
{
  "phone": "{{$json.telefono}}",
  "name": "{{$json.nombre}}"
}
```

Usá las expresiones que correspondan al payload real del proveedor de WhatsApp.

## Respetar apagado y pausas

Después del HTTP Request, agregá un nodo **If**:

```text
{{$json.data.assistant.shouldReply}} is true
```

- `true`: armá el prompt con `data.knowledge` y `data.business`, llamá al modelo y enviá la respuesta.
- `false`: terminá el flujo sin responder automáticamente.

`shouldReply` ya combina el apagado global con la pausa específica del teléfono.

## Datos disponibles

- `data.knowledge`: información activa cargada desde el panel.
- `data.business.products`: catálogo y stock actuales.
- `data.business.offers`: ofertas activas.
- `data.business.branches`: direcciones, teléfonos y horarios.
- `data.business.delivery`: compra mínima, franjas y configuración de envío.

El proyecto no almacena mensajes de WhatsApp. Las notas internas de cada contacto tampoco se
incluyen en la respuesta de la API.
