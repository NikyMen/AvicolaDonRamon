# SPEC: Catálogo Cuántico, precios y asistente de WhatsApp

**Estado:** Borrador <!-- Borrador | En revisión | Aprobada -->

**Revisión:** 2026-09-17, precio único inicial. El usuario autoriza preparar el plan junto al spec sin seguir interrogando ahora. Documentos provisionales: las propuestas siguientes no reemplazan las decisiones comerciales pendientes.

<!-- PARA LA PERSONA
Copia esta plantilla como SPEC.md en una carpeta de la funcionalidad.
Pide al agente que la complete contigo usando MOBILE_GUIDELINES.md.
SPEC.md define qué debe cumplirse; PLAN.md desarrolla cómo implementarlo;
TASKS.md organiza los pasos de ejecución.
-->

<!-- PARA EL AGENTE
- Lee las instrucciones del proyecto y MOBILE_GUIDELINES.md. Inspecciona el
  repositorio para comprobar el comportamiento actual. Si falta la guía, pide su ubicación.
- Completa esta spec con la persona: investiga lo comprobable y consulta las
  decisiones pendientes. Haz pocas preguntas por vez y actualiza las respuestas.
- No inventes requisitos ni exclusiones. Distingue propuestas de decisiones
  confirmadas y marca como PENDIENTE lo que aún no esté resuelto.
- Aplica las consideraciones mobile relevantes sin ampliar el alcance automáticamente.
- No incluyas diseño de clases, tablas, componentes, archivos o algoritmos:
  esos detalles pertenecen a PLAN.md. Sí registra restricciones explícitas del pedido.
- Mantén el documento breve y proporcional a la funcionalidad. Conserva los comentarios.
- Un documento completo no está aprobado automáticamente. Solicita aprobación
  antes de marcarlo como Aprobada. No implementes durante esta etapa.
-->

## Qué construimos y para quién

<!-- Qué necesidad resolvemos, quién tiene esa necesidad y qué podrá hacer.
Describe el objetivo en lenguaje de producto. -->

Clientes y equipo de Avícola Don Ramón necesitan consultar todos los productos de Cuántico con precios correctos y completar los pedidos de mejora del grupo de WhatsApp. El asistente debe responder usando la información necesaria para cada consulta, con un consumo de IA controlado.

## Situación actual

<!-- Comportamiento actual relevante, limitación que queremos resolver y
comportamientos existentes que deben conservarse. No describas la arquitectura. -->

Comprobado en el código local durante esta conversación: el conversor elimina el punto de `817.0000` y obtiene `8170000`; la sincronización marca los productos como habilitados y asigna stock 50 a productos nuevos cuando la fuente no informa stock. El script local de preparación de n8n incluye el objeto comercial completo en la entrada de IA.

En los chats anteriores se reportaron aproximadamente 3.800 productos y un consumo elevado. PENDIENTE: verificar el flujo activo, la versión publicada, el consumo real y qué mejoras del grupo ya funcionan. El script local no demuestra qué ejecuta hoy n8n.

Revisión estática del flujo aportado el 17/9/2026 (sin ejecutar ni enviar mensajes):

| Tema | Evidencia y estado |
| --- | --- |
| Recorrido actual | La segunda exportación del 17/9/2026 reemplaza la anterior: la consulta web conecta con `Responder Don Ramon` y continúa por los filtros hasta el agente y el envío. El corte en el contador quedó corregido en la copia; publicación y ejecución real pendientes de verificar. |
| Catálogo y consumo | Esta exportación sí filtra productos: hasta 30 por consulta o 60 si detecta palabras como «precios» o «lista». Corrige la hipótesis basada en el script local anterior. No hay límite global de texto; se incluyen conocimiento, ofertas y horarios. Memoria configurada en 8 y modelo conectado `gpt-4.1-mini`. El costo real requiere una ejecución con sus datos de consumo. |
| Calidad de búsqueda | Busca palabras del mensaje actual; puede perder referencias como «el más barato» o variantes fuera del límite. Una solicitud de lista recibe como máximo 60 productos, no la lista completa. |
| Identidad | Consulta el contacto vinculado en Kommo y extrae teléfono; no verifica identidad mediante búsqueda por teléfono. Prioriza el nombre recibido del mensaje sobre el del contacto. La lectura del lead no interpreta `data` cuando es texto JSON, a diferencia de la lectura del contacto. |
| Condición comercial | Captura aportada confirma el campo «Condición comercial» en el contacto, con opciones Sin definir, Contado efectivo, Transferencia, Debito, QR y Cuenta corriente. Coincide con el nombre y ubicación que busca el flujo. PENDIENTE verificar el valor devuelto en una ejecución real; la captura no confirma una opción guardada. No se observa selección de precios por condición ni reglas explícitas suficientes para cuenta corriente. |
| Horarios | La entrada distingue retiro y WhatsApp, pero las instrucciones del agente los igualan al salón. El código web local también devuelve horarios fijos comunes. La fecha/hora se calcula antes, pero no se incluye en el texto enviado al agente. |
| Reparto | Existe la indicación aproximada 08:00/08:30; falta una regla exacta y calendario verificado. |
| Bienvenida y aclaraciones | Las instrucciones incluyen 🐔 y preguntas por marca, presentación y menudos. Configurado, pendiente de prueba real. |
| Derivación | Intenta mover el contacto comercial a una etapa cuyo nombre coincida con atención humana. No se observa aviso/asignación explícita ni pausa automática al derivar. La web local admite pausa manual por teléfono. |
| Pedidos | El agente emite `ORDER_STARTED`, pero el lector de respuesta y el selector de etapas aceptan `CHECKOUT_SENT`. Ese desacuerdo convierte el evento de pedido en `HUMAN_REQUIRED`. No se observa creación de un pedido en esta exportación. |
| Consultas pendientes | El código web local registra mensajes de entrada, pero eso no equivale a una bandeja de consultas pendientes con responsable y resolución. No se observa esa gestión en el flujo aportado. |
| Clientes inactivos y PDF | No hay nodos para detectar inactividad, enviar campañas, generar o adjuntar PDF. PENDIENTE comprobar si existen otros flujos. |
| Variantes Resistiré/Noelma | Existe instrucción de mostrar alternativas, pero no datos reales del catálogo en la exportación que permitan verificar estas variantes. |
| Controles y fallos | En la segunda exportación hay filtro de contactos permitidos y control de pausa dentro del recorrido conectado. Varias llamadas continúan tras error; tras fallar la escritura de respuesta podría intentarse lanzar el Salesbot con un texto anterior. Su configuración interna no está incluida. |

Otros puntos para el plan: el disparador manual va directo al agente sin preparar contexto; hay un filtro vacío que compara dos cadenas vacías; una cantidad `null` se convierte en 0 al leer la respuesta. No se han probado credenciales, respuestas externas, publicación, entrega de mensajes ni consumo.

## Dentro del alcance

<!-- Requisitos concretos, con identificadores estables para vincularlos a
criterios, decisiones del plan y tareas. -->

- **RF-01:** Consultar el catálogo completo de Cuántico; PENDIENTE acordar cuáles productos se ofrecen para venta y cómo se actualizan.
- **RF-02:** Interpretar correctamente los precios de origen, corrigiendo los ceros agregados por la conversión. PENDIENTE confirmar campo, moneda, redondeo y tratamiento de precios cero.
- **RF-03:** Reducir el consumo de IA por consulta conservando el acceso a todo el catálogo. PENDIENTE acordar presupuesto y calidad esperada.
- **RF-04:** Informar por separado horarios de salón, atención por WhatsApp y retiro de pedidos, según local y día.
- **RF-05:** Reconocer al cliente por su teléfono y hacer visible su identidad al equipo. PENDIENTE definir fuente y casos sin coincidencia o con duplicados.
- **RF-06:** Reconocer la condición comercial de Kommo. Por decisión inicial del usuario, todas las opciones usan el mismo precio, incluida cuenta corriente. Reconocerla no autoriza por sí solo crédito, límite ni confirmación de venta. **Revisión 2026-09-25:** cuenta corriente pasa a usar una lista mayorista aparte, con la condición sincronizada entre la web y Kommo; ver `docs/cuenta-corriente-kommo.md`.
- **RF-07:** Guardar consultas pendientes para que el equipo pueda continuarlas. PENDIENTE definir responsables y cómo se cierran.
- **RF-08:** Identificar clientes que dejaron de comprar y enviarles mensajes. Solicitud del grupo pendiente de acordar para esta entrega: plazo de inactividad, historial de compras, destinatarios, frecuencia y aprobación de envíos.
- **RF-09:** Derivar automáticamente casos y pedidos especiales a una persona. PENDIENTE definir cuáles y cómo se retoma la atención.
- **RF-10:** Informar horarios de reparto y fecha posible del pedido para Colonia Avellaneda y San Benito, contemplando el horario de corte.
- **RF-11:** Incluir 🐔 en la bienvenida.
- **RF-12:** Ante una solicitud de lista de precios, entregar una lista completa descargable; el grupo propone PDF. PENDIENTE confirmar formato, productos incluidos y lista comercial aplicable.
- **RF-13:** Ante pedidos ambiguos de cajón de pollo, preguntar marca y si es con o sin menudo antes de dar por definido el producto; aclarar presentación y cantidad cuando falten.
- **RF-14:** Considerar todas las variantes pertinentes del catálogo al ofrecer alternativas, incluyendo Pata Resistiré de 15 kg cuando corresponda, diferenciándola de Noelma de 20 kg.

## Fuera de alcance

<!-- Exclusiones acordadas, no deducidas por el agente. Si no hay exclusiones
adicionales, indícalo tras revisarlo con la persona. -->

- En esta etapa se preparan documentos; no se publica ni se modifica el flujo activo. No se acordaron exclusiones definitivas de los pedidos del grupo. Las campañas y reglas comerciales pendientes permanecen en el alcance por definir, sin activación automática.

## Flujo de usuario

<!-- Cómo se inicia, qué hace el usuario y qué resultado obtiene.
Incluye pantallas afectadas, navegación y alternativas relevantes. -->

1. El cliente hace una consulta por WhatsApp.
2. El asistente consulta la información comercial y los productos necesarios.
3. El cliente recibe una respuesta con información verificada. PENDIENTE definir cuándo se toma un pedido, se envía un enlace o interviene una persona.

## Datos y reglas de negocio

<!-- Información que necesita el usuario, campos obligatorios, validaciones,
límites y reglas como duplicados u orden de presentación. Describe significado
y comportamiento, sin diseñar tablas, DTO, DAO ni almacenamiento. -->

- Fuente de los pedidos: mensajes del grupo del 7/9/2026, aportados por el usuario. Su recepción no prueba que estén implementados.
- Horarios de salón, WhatsApp, retiro y reparto son conceptos separados; faltan valores exactos por local y día.
- Para Colonia Avellaneda y San Benito se solicita promover pedidos el día anterior. El grupo menciona corte aproximado a las 08:00 u 08:30; PENDIENTE elegir hora exacta, días de reparto y tratamiento de feriados. Después del corte se pide pasar al día siguiente; falta aclarar qué ocurre si no hay reparto ese día.
- El campo de contacto de Kommo contiene seis opciones visibles: Sin definir, Contado efectivo, Transferencia, Debito, QR y Cuenta corriente. Supuesto inicial indicado por el usuario: mismo precio para todas; no implementar listas distintas. Sin definir no equivale a crédito autorizado.
- Según el grupo, Pata Resistiré es una opción económica de 15 kg y segunda marca de Noelma; Noelma se ofrece en 20 kg. PENDIENTE verificar nombres, códigos y presentaciones en el catálogo vigente.
- La expresión «1 cajón de pollo x 7» requiere aclarar su significado comercial; no asumir marca, menudo ni peso.
- Falta acordar datos guardados en consultas pendientes y reglas de contacto a clientes inactivos.

## Comportamiento mobile y casos alternativos

<!-- Adapta la tabla usando MOBILE_GUIDELINES.md. Añade escenarios relevantes.
Marca No aplica con su motivo cuando corresponda. No presupongas soporte offline
ni conservación de todo el estado. Expresa resultados, no mecanismos técnicos. -->

| Situación | Comportamiento esperado |
| --- | --- |
| Carga o acción en curso | Propuesta: evitar respuestas duplicadas ante mensajes repetidos y conservar el orden por conversación. |
| Sin datos | Propuesta: indicar que falta verificar precio/stock; no tratar una búsqueda parcial vacía como inexistencia del producto. |
| Entrada inválida | Propuesta: pedir una aclaración breve; cantidad no indicada sigue desconocida. |
| Error o espera excesiva | Propuesta: conservar consulta recuperable y no anunciar envío, reserva o derivación sin evidencia. |
| Sin conexión o conexión interrumpida | Propuesta: recuperar sin reenviar una respuesta anterior ni duplicar pedidos; no prometer atención offline. |
| Cancelar o volver atrás | Propuesta: cancelaciones/modificaciones de pedidos se derivan a una persona sin afirmar que ya se realizaron. |
| Pasar a segundo plano y regresar | Propuesta: continuar la conversación correspondiente sin mezclar clientes. |
| Recrear la pantalla | No se construye pantalla nativa; comprobar continuidad al reabrir WhatsApp. |
| Reabrir después de terminarse el proceso | Propuesta: la consulta pendiente permanece recuperable; no prometer conservación de toda la memoria del bot. |
| Otros puntos aplicables de la guía | Propuesta: lista descargable legible en móvil, precios/unidades claros, fecha de actualización visible. |

**Puntos de la guía no aplicables y motivo:** arquitectura y permisos de una app Android nativa: se trabaja sobre WhatsApp y la web existentes. Las propuestas de esta tabla deben validarse en la revisión; no implican un rediseño de pantallas.

## Restricciones del pedido

<!-- Condiciones ya impuestas: compatibilidad, límites de alcance, requisitos
de accesibilidad o rendimiento medibles, o una tecnología expresamente exigida.
Ejemplo: Usar Room puede ser una restricción; el diseño de entidades va en PLAN.md.
No conviertas una preferencia del agente en una restricción. -->

- Trabajar primero en la especificación y después en el plan; explicar y preguntar en lenguaje sencillo.
- Usar esta plantilla y conservar su estructura y comentarios.
- Entregar cualquier cambio de n8n como nodos JSON listos para copiar, pegar y reemplazar, indicando nombre y conexiones necesarias. No sustituir esta entrega por instrucciones de editar fragmentos sueltos.
- Priorizar cambios mínimos y robustos, respetar el estilo y la arquitectura existentes; usar pnpm y justificar dependencias nuevas.

## Criterios de aceptación

<!-- Resultados observables que permitan decidir si se cumple cada requisito.
Incluye los casos alternativos acordados. No uses Funciona correctamente.
Repite el formato según sea necesario. -->

- **CA-01 · RF-01:** PENDIENTE acordar catálogo esperado y excepciones para comprobar cobertura completa.
- **CA-02 · RF-02:** Dado un precio decimal de origen `817.0000`, cuando se interpreta, entonces su valor es 817, sin multiplicarlo por eliminar el punto. Esto no confirma que sea el precio comercial vigente.
- **CA-03 · RF-03:** Propuesta para revisión: medir diez consultas representativas y una conversación de ocho turnos; ninguna llamada supera 10.000 tokens totales de entrada, sin perder identidad, precios ni referencias a productos. Registrar comparación antes/después con el mismo modelo. Presupuesto mensual pendiente.
- **CA-04 · RF-04:** Ante una consulta de horarios, la respuesta distingue salón, WhatsApp y retiro usando los valores acordados; PENDIENTE completar esos valores.
- **CA-05 · RF-05:** Un teléfono asociado a un cliente permite reconocerlo y mostrar su identidad al equipo; PENDIENTE resolver desconocidos y duplicados.
- **CA-06 · RF-06:** Para un mismo producto vigente, cada opción comercial recibe el mismo precio; el bot conserva la condición registrada y no interpreta Sin definir como autorización de cuenta corriente. La política de crédito sigue pendiente.
- **CA-07 · RF-07:** Una consulta pendiente puede localizarse y retomarse por el equipo; PENDIENTE acordar qué se guarda y cuándo se cierra.
- **CA-08 · RF-08:** PENDIENTE acordar reglas verificables de inactividad y envíos antes de incluir su ejecución en esta entrega.
- **CA-09 · RF-09:** Ante un caso especial acordado, el cliente queda derivado al equipo; PENDIENTE definir aviso y conducta del bot durante la intervención humana.
- **CA-10 · RF-10:** Consultas antes y después del corte reciben la fecha de reparto que corresponde a su zona; PENDIENTE hora y calendario exactos.
- **CA-11 · RF-11:** El mensaje de bienvenida incluye 🐔.
- **CA-12 · RF-12:** Al pedir la lista de precios se recibe una lista completa descargable, en vez de una selección parcial; PENDIENTE definir contenido, formato y vigencia.
- **CA-13 · RF-13:** Ante «1 cajón de pollo x 7» sin marca ni detalle de menudo, el bot pide esas aclaraciones antes de definir el producto.
- **CA-14 · RF-14:** Si Pata Resistiré de 15 kg está incluida y habilitada en el catálogo acordado, aparece entre las alternativas pertinentes y se distingue de Noelma de 20 kg.

## Cómo se comprueba el comportamiento

<!-- Una fila por criterio: escenario y resultado que debemos comprobar.
La selección de tests, herramientas, comandos y evidencias se desarrolla en PLAN.md.
No marques los criterios como superados durante la especificación. -->

| Criterio | Condiciones y pasos | Resultado esperado |
| --- | --- | --- |
| CA-01 | Comparar IDs del catálogo fuente con los importados y repetir actualización. | Sin duplicados; exclusiones e inválidos explicados. Política de productos ofrecidos pendiente. |
| CA-02 | Comparar un precio decimal de origen `817.0000` con el valor interpretado. | 817; confirmar por separado su vigencia comercial. |
| CA-03 | PENDIENTE: medir consultas representativas y respuestas. | PENDIENTE: presupuesto y calidad acordados. |
| CA-04 | Consultar salón, WhatsApp y retiro. | Horarios separados, según valores por confirmar. |
| CA-05 | Consultar con teléfono conocido, desconocido y duplicado. | Identificación verificada; alternativas pendientes de definir. |
| CA-06 | Consultar con clientes de ambas condiciones y sin condición. | Condición y precios correctos; reglas pendientes. |
| CA-07 | Dejar una consulta sin resolver y retomarla. | El equipo puede encontrarla y continuarla. |
| CA-08 | PENDIENTE: acordar ejemplos de inactividad y envío. | PENDIENTE: reglas y alcance de esta entrega. |
| CA-09 | Presentar un caso especial acordado. | Derivación comprobable; detalles pendientes. |
| CA-10 | Pedir reparto para ambas zonas antes y después del corte. | Fecha acorde a horario y calendario por confirmar. |
| CA-11 | Iniciar una conversación que recibe bienvenida. | Incluye 🐔. |
| CA-12 | Solicitar lista de precios. | Lista completa descargable conforme al alcance acordado. |
| CA-13 | Pedir «1 cajón de pollo x 7» sin más detalles. | Pregunta marca y con/sin menudo antes de definirlo. |
| CA-14 | Consultar opciones de pata con ambas variantes en catálogo. | Incluye Resistiré 15 kg y distingue Noelma 20 kg. |

## Decisiones pendientes

<!-- Al resolverlas, actualiza las secciones afectadas. Escribe Ninguna cuando
no queden pendientes funcionales ni restricciones por decidir. -->

- Lista del grupo recibida: comprobar cuáles de RF-04 a RF-14 ya funcionan hoy.
- Segunda exportación recibida: conexión principal corregida y parámetros de los nodos conservados respecto de la primera. Verificar publicación, ejecuciones y otros flujos antes de marcar funcionalidades como operativas.
- Nombre, opciones y ubicación del campo comercial confirmados por captura; precio único inicial confirmado por el usuario. Falta comprobar lectura real y autorización de cuenta corriente.
- Resolver el conflicto entre cierre exclusivamente por WhatsApp en el agente y cierre en web indicado por el contexto local; confirmar el canal deseado y cómo se entregará la lista descargable.
- Confirmar horarios por canal/local, corte exacto y calendario de reparto.
- Validar identificación y condición comercial desde Kommo y manejo de datos faltantes; no hay precios distintos por condición en esta versión.
- Definir gestión de consultas pendientes y casos que se derivan a personas.
- Acordar si recuperación de clientes inactivos entra en esta entrega y sus reglas.
- Confirmar PDF, contenido de la lista, actualización y acceso según condición comercial.
- Aclarar «x 7» y verificar variantes Resistiré/Noelma en Cuántico.
- Confirmar si el bot y la web atienden clientes reales.
- Exportación y ajustes de memoria/modelo revisados; falta evidencia de ejecución y consumo real.
- Confirmar con Cuántico campo de precio, moneda, vigencia y stock real.
- Acordar tratamiento de precios cero, productos deshabilitados y stock desconocido.
- Acordar frecuencia de actualización y comportamiento ante fallos.
- Definir si el bot toma pedidos, envía enlaces o deriva; incluir cuenta corriente.
- Acordar presupuesto de IA y cómo comprobar calidad y consumo.
- Completar casos alternativos y exclusiones con la persona.

<!-- ANTES DE SOLICITAR APROBACIÓN
Comprueba que el alcance está acordado, los flujos son coherentes, los puntos
mobile relevantes están cubiertos y cada requisito tiene criterios comprobables.
Resuelve las dudas y los marcadores pendientes. Mantén el diseño técnico en PLAN.md.
-->
