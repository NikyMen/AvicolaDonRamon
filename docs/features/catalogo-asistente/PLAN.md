# PLAN: Catálogo Cuántico, precios y asistente de WhatsApp

**SPEC de referencia:** [SPEC.md](SPEC.md)
**Versión de la spec revisada:** 2026-09-17 — precio único inicial
**Estado:** Borrador <!-- Borrador | En revisión | Aprobado -->

<!-- PARA LA PERSONA
Copia esta plantilla como PLAN.md junto a la SPEC.md aprobada.
Este documento define la solución técnica. Una vez revisado, el agente puede
derivar TASKS.md con tareas, dependencias y comprobaciones.
-->

<!-- PARA EL AGENTE
- Lee la SPEC.md aprobada, las instrucciones del proyecto y MOBILE_GUIDELINES.md.
  Si falta un documento necesario o la spec no está aprobada, indícalo antes de avanzar.
- Inspecciona el repositorio. Referencia rutas verificadas y distingue las nuevas propuestas.
- Propón una solución proporcional al alcance y coherente con el proyecto.
  Reutiliza lo existente y justifica nuevas dependencias o cambios de arquitectura.
- Distingue hechos, decisiones confirmadas y propuestas. Consulta las decisiones
  no resueltas; haz pocas preguntas por vez y actualiza el plan con las respuestas.
- Referencia los requisitos y criterios por su ID, sin copiar toda la spec.
- Si una decisión cambia el comportamiento o alcance, vuelve a la spec y solicita
  confirmación. No resuelvas una duda de producto mediante una suposición técnica.
- Conserva estos comentarios. No implementes durante la planificación.
- Solicita aprobación antes de marcar el plan como Aprobado. La autorización
  para implementar debe ser explícita; no se deduce del estado de los documentos.
-->

Nota: spec aún en borrador. El usuario pidió preparar todo el plan ahora; se avanza por esa instrucción explícita sin marcar aprobación ni implementar. Las decisiones comerciales pendientes bloquean solo su etapa dependiente.

## Contexto técnico verificado

<!-- Qué existe hoy y cómo participa en la funcionalidad. -->

| Componente o archivo existente | Ruta verificada | Responsabilidad y uso previsto |
| --- | --- | --- |
| Importación | src/lib/cuantico.ts | Conversión defectuosa, stock por defecto 50 y habilitación forzada. |
| Sincronización | src/app/api/integraciones/cuantico/productos/route.ts | POST autenticado que modifica productos. |
| Contexto | src/app/api/v1/assistant/context/route.ts | Catálogo completo, horarios fijos y control de pausa. |
| Catálogo | src/app/api/v1/assistant/catalog/route.ts | Datos comerciales públicos. |
| Contactos y conocimiento | src/lib/whatsapp-assistant.ts | Registro, pausa y selección de conocimiento. |
| Flujo vigente aportado | Archivo adjunto 9a83ecf9-71a9-40a0-9bcd-46b60b5a95d7/pasted-text.txt | Segunda exportación; reemplaza la anterior. |
| Generador anterior | scripts/repair-avicola-n8n.mjs | No usar como fuente del flujo vigente: tiene código anterior. |

**Convenciones y patrón de referencia:** Next.js/TypeScript, repositorio de datos existente, Prisma y pnpm 10.33.2. Preservar cambios locales; inspeccionar diffs antes de editar. Sin subagentes inicialmente: trabajo acotado y secuencial.

## Solución propuesta

<!-- Explica el enfoque y sus motivos. Describe las responsabilidades y el
recorrido de datos y eventos hasta la interfaz. Usa un diagrama si aporta claridad. -->

1. Corregir importación con el formato real de Cuántico, sin dividir precios por factores supuestos. Preparar vista previa de cambios por ID y conteo de rechazos antes de resincronizar.
2. Buscar sobre todo el catálogo en el servidor y devolver a la IA solo coincidencias compactas. Separar consulta puntual, saludo y solicitud de lista completa; el PDF se genera con datos, no pidiendo a la IA que escriba miles de productos.
3. Ajustar los nodos actuales de n8n: lectura consistente de Kommo, identidad confirmada, condición comercial con precio único, eventos coherentes y entrega verificada.
4. Preservar en memoria solo conversación útil y selección reciente de productos. Verificar cómo guarda entradas la versión instalada de n8n antes de elegir el mecanismo; bajar la ventana por sí solo no garantiza evitar repetición de contexto.
5. Completar horarios, derivación y pendientes; PDF y recuperación de clientes siguen etapas condicionadas por decisiones explícitas.

Propuestas para CA-03: hasta 12 coincidencias iniciales, ampliación acotada cuando falten variantes, cero productos para saludos; objetivo máximo de 10.000 tokens de entrada total por llamada en la batería acordada. Medir instrucciones + mensaje + contexto + historial + herramientas, no estimar por caracteres. Presupuesto monetario mensual pendiente; no prometer un porcentaje de ahorro sin medición.

## Módulos y componentes afectados

<!-- Si el proyecto está modularizado, identifica los módulos afectados, sus
responsabilidades y la dirección de sus dependencias. Respeta los límites
existentes y justifica cualquier módulo o dependencia nueva. Si no está
modularizado, describe las carpetas o componentes afectados sin introducir
modularización fuera del alcance; marca la tabla de módulos como No aplica. -->

| Módulo | Existe / nuevo | Responsabilidad y cambios | Dependencias afectadas |
| --- | --- | --- | --- |
| Aplicación web y flujo n8n | Existentes | Cambios puntuales; no se introduce modularización nueva | Contrato de contexto entre ambos |

<!-- Distingue lo que se reutiliza, modifica o crea. Las rutas nuevas son propuestas.
Señala impacto sobre modelos, contratos o componentes compartidos. -->

| Componente o ruta | Acción | Cambio y responsabilidad | Requisito relacionado |
| --- | --- | --- | --- |
| src/lib/cuantico.ts y ruta de sincronización | Modificar | Parser y vista previa; preservar datos editoriales existentes | RF-01/02 |
| src/app/api/v1/assistant/context/route.ts | Modificar | Selección acotada y metadatos de catálogo parcial; mantener pausa | RF-03/04/10/14 |
| src/lib/whatsapp-assistant.ts | Modificar | Límites estrictos de conocimiento, incluso primer resultado y fallback | RF-03 |
| docs/features/catalogo-asistente/n8n/ (propuesta) | Crear | JSON de nodos reemplazables sin secretos y guía de conexiones | RF-03/05/06/09/11/13 |
| src/app/api/v1/assistant/catalog/route.ts | Reutilizar/revisar | Coherencia de datos comerciales; conservar consumidores actuales | RF-01/04/10/12 |
| Kommo, configuración existente | Reutilizar | Condición, responsable, etapas y tareas; inspeccionar capacidades antes de ampliar | RF-05/06/07/08/09 |
| Generación y entrega PDF (ruta por definir) | Propuesta | Archivo de catálogo vigente, cacheado por versión, adjunto por canal compatible | RF-12 |

## Datos y contratos

<!-- Completa solo lo aplicable. Si un punto no aplica, indica el motivo. -->

- **Modelos y contratos de entrada y salida:** Mantener phone, leadId, name y message; proponer modo de contexto acotado compatible con consumidores existentes. Añadir total, cantidad seleccionada, catálogo parcial y fecha de datos. Respetar IDs reales y cantidad desconocida como null.
- **Identificadores, relaciones y restricciones:** Usar cuantico-<IdErp>, no emparejar productos por nombre. Validar contacto asociado al lead y teléfono normalizado; no elegir otra persona ante conflicto. Unificar ORDER_STARTED entre agente, parser y etapas.
- **Origen de los datos mostrados y transformaciones:** Cuántico para producto/precio; Kommo para identidad y condición. Mismo precio para todas las condiciones. Confirmar formato decimal por campo; 817.0000 → 817. No aplicar heurística de miles a valores ambiguos sin evidencia.
- **Persistencia, consultas y actualizaciones:** Proponer vista previa sin escrituras y sincronización repetible con conteos de creados, actualizados, omitidos e inválidos. Consultas pendientes como tareas/notas en Kommo si satisface el circuito acordado, evitando otra bandeja sin necesidad.
- **Convivencia entre datos locales y remotos:** Preservar fotos, categorías y descripciones editadas si Cuántico no es fuente acordada. Habilitado para venta y stock son distintos. No asumir stock 50 ni disponibilidad por dato ausente.
- **Compatibilidad y migraciones de datos existentes:** Resincronizar solo IDs de Cuántico tras revisar comparación y respaldo. Proponer precio cero/ inválido como no cotizable; política pendiente. Si stock desconocido exige cambio de modelo, revisar consumidores y migración antes de implementarlo; no sustituirlo silenciosamente por cero.

## Estado, operaciones y errores

<!-- Cómo se implementan los comportamientos aprobados en la spec.
Referencia RF/CA y aplica las consideraciones relevantes de MOBILE_GUIDELINES.md. -->

- **Gestión del estado de interfaz y navegación:** WhatsApp sigue siendo la interfaz existente. No modificar checkout hasta resolver contradicción de canal. Comunicar falta de información sin confirmar pedidos.
- **Conservación y restauración del estado:** Conservar sesión estable por conversación y referencias recientes de productos; evitar guardar catálogo/contexto en cada turno. Probar frases «el más barato» y «dos de ese».
- **Ejecución, concurrencia y cancelación de operaciones:** Ordenar respuestas por conversación y prevenir mezcla entre clientes. Revisar deduplicación previa al envío: fallos deben poder recuperarse sin responder dos veces.
- **Errores, reintentos y prevención de duplicados:** Normalizar respuestas objeto/texto en todos los lectores de Kommo. Bloquear Salesbot si falla la escritura del texto; comprobar cambio de etapa y entrega. No reenviar operaciones no idempotentes a ciegas. Registrar estado fallido recuperable.
- **Otras consideraciones mobile aplicables y su solución:** Probar mensajes consecutivos, reapertura del chat y descarga PDF en móvil. Diseño Android nativo y permisos de dispositivo no aplican.

## Dependencias y configuración

<!-- Librerías, servicios, permisos o configuración afectados. Verifica compatibilidad
con el proyecto y justifica las incorporaciones. No agregues dependencias por defecto. -->

- Mantener modelo actual del bot durante la comparación de costos. Cambiar el modelo de Codex no cambia el de n8n.
- No agregar dependencias en la primera etapa. Para PDF verificar herramientas existentes; justificar cualquier biblioteca antes de incorporarla.
- Verificar versión instalada de n8n, respuesta real de Kommo, Salesbot y forma de adjuntar archivos antes de construir nodos de entrega. Credenciales mediante conexiones existentes.

## Estrategia de validación

<!-- Una fila por criterio de la spec. Selecciona el método capaz de demostrarlo:
test unitario, integración, UI o prueba manual. No todos requieren todos los métodos.
Identifica tests existentes y separa los nuevos propuestos. Incluye regresiones relevantes.
Una captura aislada no demuestra persistencia ni ausencia de peticiones de red. -->

| Criterio | Método y test existente o propuesto | Entorno y datos necesarios | Evidencia prevista |
| --- | --- | --- | --- |
| CA-01 | Integración propuesta: catálogo fuente vs vista previa e importación repetida | Muestra anonimizada y entorno de prueba | Conteos, IDs y ausencia de duplicados |
| CA-02 | Pruebas de parser y comparación de resincronización | Decimales de 4 posiciones, números, nulos, negativos, cero y formatos ambiguos | Valores esperados; rechazos explícitos, sin factor arbitrario |
| CA-03 | Medición antes/después, 10 consultas y conversación de 8 turnos | Mismo modelo y catálogo representativo; sesiones separadas | Tokens reales por llamada, total por conversación, latencia y calidad |
| CA-04 | Prueba de horarios separados | Horarios confirmados por local/canal | Respuestas coinciden, sin igualarlos por defecto |
| CA-05 | Lectores con objeto/JSON textual y prueba de contacto | Conocido, desconocido, faltante y conflicto | Nombre confirmado o aclaración, sin mezclar personas |
| CA-06 | Una consulta para cada opción comercial | Seis valores de Kommo | Mismo precio, condición preservada, sin crédito inventado |
| CA-07 | Crear, recuperar y cerrar consulta de prueba | Responsable/circuito acordados | Pendiente visible y cierre verificable |
| CA-08 | Simulación sin envíos | Historial de compras y regla aprobada | Selección correcta, sin duplicados; activación pendiente |
| CA-09 | Caso especial y siguiente mensaje | Etapa/responsable y regla de pausa acordados | Derivación y pausa verificables; fallo visible |
| CA-10 | Consultas alrededor del corte y días sin reparto | Hora y calendario confirmados | Próxima fecha válida |
| CA-11 | Saludo inicial y segundo turno | Sesión nueva y existente | 🐔 inicial sin repetir bienvenida |
| CA-12 | Generar/abrir archivo y comparar catálogo | Datos vigentes, entrega de prueba en móvil | Lista completa legible, fecha y precios coinciden |
| CA-13 | Pedido ambiguo y aclaraciones en turnos | Cajón x7 y cantidad omitida | Pregunta marca/menudos/presentación; null no pasa a cero |
| CA-14 | Búsqueda de pata y alternativas | IDs confirmados Resistiré y Noelma | 15 kg y 20 kg diferenciados |

**Comprobaciones de regresión:** pausa global y por contacto, lista de pruebas, fallos de contexto, doble webhook, error de Salesbot, cantidades nulas, edición local de productos y precio único.

**Comandos verificados para compilar y ejecutar tests:** package.json define pnpm build y pnpm lint; disponibles TypeScript y tsx. Proponer pnpm exec tsc --noEmit y pruebas acotadas con tsx. No existe script test verificado; revisar compatibilidad de next lint antes de usarlo. Ningún comando fue ejecutado en esta etapa documental.

**Pruebas en dispositivo, emulador o simulador:** WhatsApp de prueba y apertura del PDF en teléfono; no hace falta emulador Android.

**Limitaciones del entorno:** exportación sin historial de ejecución, credenciales ni Salesbot interno; no se verificó VPS. No activar/publicar ni enviar mensajes a clientes durante pruebas locales.

<!-- Esta sección planifica la validación. Durante la implementación, registra
en TASKS.md o en el informe de validación acordado los resultados y evidencias
reales. Distingue pruebas ejecutadas, fallidas, no ejecutadas y bloqueadas.
Compilar o tener tests en verde no sustituye revisar los criterios de la spec. -->

## Orden de implementación

<!-- Etapas y dependencias principales. El desglose ejecutable se escribe en TASKS.md.
Incluye puntos de comprobación para avanzar con cambios pequeños. -->

1. E1 — Base reproducible: preservar cambios, confirmar segunda exportación y obtener muestra de precios/consumo sin llamar a IA innecesariamente.
2. E2 — Precios e importación (RF-01/02): parser, vista previa y pruebas. Publicación de precios espera validación comercial; no borrar catálogo.
3. E3 — Contexto y consumo (RF-03/14): selección global acotada, límites por sección, memoria y pruebas de seguimiento. Mantener catálogo completo consultable.
4. E4 — Nodos n8n (RF-05/06/09/11/13): eventos, identidad, null, fecha actual y errores. Entregar JSON de nodos completo con instrucciones exactas de reemplazo; importar primero en copia de prueba.
5. E5 — Operación humana y horarios (RF-04/07/09/10): resolver valores y responsables, configurar pausa/pendientes y verificar recuperación. No inventar hora de corte.
6. E6 — Lista descargable (RF-12): validar catálogo y canal, generar PDF fuera de IA y comprobar envío/descarga completa.
7. E7 — Clientes inactivos (RF-08): definir compras reales, plazo, frecuencia y mensaje; simular candidatos antes de cualquier activación autorizada.
8. E8 — Validación y despliegue: completar matriz CA, comparar consumo, guardar respaldo de flujo/datos y preparar reversión. No dar por terminado lo que depende de producción sin evidencia.

## Riesgos y decisiones pendientes

<!-- Riesgos concretos de esta solución y cómo se resolverán, sin listas genéricas.
Escribe Ninguna en las decisiones pendientes cuando estén resueltas. -->

- **Riesgos y medidas propuestas:** memoria puede repetir contexto; medir entrada final real. Búsqueda puede omitir variantes; probar cobertura y seguimientos. Stock 50 previo es ficticio; auditar antes de filtrar ventas. Reintento puede duplicar mensajes; verificar estado de entrega. Cambios locales amplios; editar solo lo necesario.
- **Decisiones pendientes:** fuente comercial de precio/stock, política de cero, horarios/corte/calendario, permiso de crédito, circuito de responsables, canal de cierre/PDF, reglas de inactividad y presupuesto. E2–E4 pueden prepararse y probarse con datos controlados; no resolver estos puntos con valores inventados.
- **Continuación con Luna:** leer SPEC.md y este PLAN.md; empezar por E1. Cuando se autorice implementar, derivar tareas pequeñas con criterio y evidencia. No repetir toda la investigación ni usar el generador antiguo como flujo actual. Preguntar solo por decisiones que bloqueen la etapa presente. Regresar a un modelo de mayor capacidad si las pruebas descubren conflictos de datos, concurrencia o cambios amplios de contrato.

<!-- ANTES DE SOLICITAR APROBACIÓN
Comprueba que el plan cubre los requisitos, respeta las exclusiones, reutiliza
componentes verificados y permite demostrar todos los criterios de aceptación.
Resuelve dudas y marcadores pendientes. Si la spec cambió, revisa su impacto.
Tras aprobar el plan, deriva TASKS.md con IDs, dependencias, referencias a RF/CA
y comprobaciones. No marques una tarea terminada sin realizar su validación;
si está bloqueada, registra el motivo.
-->
