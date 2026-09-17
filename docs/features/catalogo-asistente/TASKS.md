# Tareas: Catálogo Cuántico, precios y asistente de WhatsApp

Estado general: En ejecución

- [x] **T-01 — Corregir lectura de precios**
  - Objetivo: interpretar formatos decimales y separadores sin agregar ceros.
  - Dependencias: ninguna.
  - Resuelve: RF-02, CA-02.
  - Validación: revisión del parser; ejecución pendiente porque las dependencias no pudieron instalarse en este entorno.

- [x] **T-02 — Evitar stock ficticio en productos nuevos**
  - Objetivo: usar 0 cuando Cuántico no informa stock.
  - Dependencias: T-01.
  - Resuelve: RF-01, RF-02.
  - Validación: revisión de la sincronización; falta probar contra una respuesta real de Cuántico.

- [x] **T-03 — Filtrar productos antes de construir el contexto de IA**
  - Objetivo: enviar coincidencias relevantes y conservar el catálogo completo en el endpoint de catálogo.
  - Dependencias: ninguna.
  - Resuelve: RF-03, RF-14.
  - Validación: revisión de selección; falta medir tokens reales con n8n.

- [ ] **T-04 — Preparar prueba de sincronización sin publicación**
  - Objetivo: comparar IDs, precios, ceros, omitidos y stock antes de actualizar producción.
  - Dependencias: T-01, credenciales o muestra real de Cuántico.
  - Resuelve: CA-01, CA-02.
  - Validación: reporte reproducible de diferencias.

- [~] **T-05 — Entregar nodos n8n reemplazables**
  - Objetivo: corregir lectura de Kommo, evento `ORDER_STARTED`, cantidad nula, fecha/hora y límites de contexto.
  - Dependencias: confirmar que la segunda exportación es la publicada.
  - Resuelve: RF-03, RF-05, RF-06, RF-09, RF-11, RF-13.
  - Entrega parcial: `n8n/Preparar-entrada-IA-Don-Ramon.json` y `n8n/Simple-Memory-Don-Ramon.json`.
  - Validación pendiente: importación en copia, ejecución con seis condiciones comerciales y mensajes ambiguos.

- [ ] **T-06 — Definir y cargar reglas comerciales operativas**
  - Objetivo: horarios exactos, corte, calendario, derivación, responsables y cuenta corriente.
  - Dependencias: respuestas del negocio.
  - Resuelve: RF-04, RF-06, RF-07, RF-09, RF-10.
  - Validación: matriz de escenarios antes/después del corte y derivación.

- [ ] **T-07 — Lista de precios descargable**
  - Objetivo: generar y entregar una lista completa con precio único.
  - Dependencias: contenido, canal y formato confirmados.
  - Resuelve: RF-12.
  - Validación: abrir el archivo en móvil y comparar productos/precios.

- [ ] **T-08 — Recuperación de clientes inactivos**
  - Objetivo: detectar, revisar y contactar clientes según reglas aprobadas.
  - Dependencias: plazo, historial, frecuencia y aprobación.
  - Resuelve: RF-08.
  - Validación: simulación sin envío y revisión de duplicados.

- [ ] **T-09 — Validación final y despliegue**
  - Objetivo: completar criterios, medir costo y publicar con reversión preparada.
  - Dependencias: T-04 a T-08.
  - Resuelve: todos los criterios aplicables.
  - Validación: evidencia de ejecución real y checklist de producción.

## Bloqueos actuales

- No hay dependencias instaladas y `pnpm install --frozen-lockfile` quedó bloqueado por permisos/red al descargar paquetes.
- No hay credenciales ni ejecuciones de producción disponibles desde este entorno.
- Faltan horarios exactos, calendario de reparto, política de consultas pendientes, reglas de inactividad y comportamiento de cuenta corriente.
