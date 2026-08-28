# Asistente inteligente de WhatsApp con n8n

## Workflow productivo de Kommo

El workflow `Avicola Don Ramon` consulta en cada mensaje:

```http
GET {{$vars.AVICOLA_WEB_API_URL}}/api/v1/assistant/catalog
```

Configurá `AVICOLA_WEB_API_URL` en las variables de n8n con la URL pública de la tienda,
sin la ruta `/api/v1`. El endpoint es de solo lectura y devuelve únicamente catálogo,
stock, ofertas, dirección, horarios, checkout y envío fijo de $2.000.

La respuesta a WhatsApp se escribe en Kommo y se envía mediante un Salesbot activo de tipo
`regular`. La credencial `AvicolaDonRamonKommo` debe autorizar correctamente la cuenta
`contactoavicoladonramoncomar.kommo.com`.

## Consulta de contexto y aprendizaje

Antes de generar cada respuesta, agregá un nodo **HTTP Request**:

- Método: `POST`
- URL: `https://TU_DOMINIO/api/v1/assistant/context`
- Autenticación: Header `Authorization: Bearer TU_API_KEY`
- Body JSON:

```json
{
  "phone": "{{$json.telefono}}",
  "name": "{{$json.nombre}}",
  "message": "{{$json.mensaje}}"
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

- `data.knowledge`: reglas y ejemplos activos, seleccionados según el mensaje actual.
- `data.knowledgeMeta`: cantidad total de entradas activas y cantidad enviada al modelo.
- `data.business.products`: catálogo y stock actuales.
- `data.business.offers`: ofertas activas.
- `data.business.branches`: direcciones, teléfonos y horarios.
- `data.business.delivery`: compra mínima, franjas y configuración de envío.

El proyecto no almacena mensajes de WhatsApp. Las notas internas de cada contacto tampoco se
incluyen en la respuesta de la API.

## Aprendizaje desde capturas

Desde **Conocimiento → Añadir conversación** se pueden cargar una o varias capturas en orden.
El navegador ejecuta OCR local, identifica las burbujas por lado y permite indicar si la captura
la tomó el negocio o el cliente. La imagen no se sube ni se guarda: se descarta después de extraer
el texto. El administrador revisa la conversación normalizada y escribe una corrección concreta,
por ejemplo: "No respondas siempre X; cuando pregunten Y, respondé Z".

Al guardar, la corrección queda activa en PostgreSQL. n8n consulta la base en cada mensaje y aplica
las pautas relevantes. El catálogo actual conserva prioridad sobre ejemplos históricos para evitar
precios, promociones o stock desactualizados.
