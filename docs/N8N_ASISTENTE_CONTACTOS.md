# Cambios del flujo n8n

MongoDB no corresponde a esta instalación: la web usa PostgreSQL/Prisma. El endpoint existente ya registra los contactos en esa base.

## Nodo nuevo

Agregar un nodo **HTTP Request** llamado `Contexto web Don Ramon` entre `Preparar contexto Don Ramon` y `Responder Don Ramon` (reemplaza al nodo actual si ya existe):

- Método: `POST`
- URL: `https://avicoladonramon.consultoriadigital.io/api/v1/assistant/context`
- Autenticación: el mismo header/API key que usa actualmente n8n para la web.
- Body JSON:

```json
{
  "leadId": "={{ $json.leadId }}",
  "phone": "={{ $json.phone }}",
  "name": "={{ $json.name }}",
  "message": "={{ $json.text }}"
}
```

Importante: el flujo recibido tenía `phone` fijo (`3431234567`). Debe quedar `={{ $json.phone }}`.

## Validación global

El nodo siguiente `Responder Don Ramon` debe ser un IF con esta condición:

```text
={{ $json.data?.assistant?.shouldReply === true }}  equals  true
```

La salida `true` continúa a `Preparar entrada IA Don Ramon`. La salida `false` termina el flujo sin enviar respuesta. Esta validación consulta tanto el apagado global como la pausa individual y se ejecuta después de crear/actualizar el contacto; por eso también cubre números nuevos.

El endpoint devuelve `contact.leadId`, `contact.phone` y `contact.name` para que la web los muestre en **Asistente WhatsApp**.

## Orden recomendado

`Preparar contexto Don Ramon` → `Contexto web Don Ramon` → `Responder Don Ramon` → `Preparar entrada IA Don Ramon` → `AI Agent`

Después de importar el cambio, ejecutar la migración Prisma en el VPS:

```bash
pnpm prisma migrate deploy
```
