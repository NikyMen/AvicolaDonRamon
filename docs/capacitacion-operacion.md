# Guion de capacitación — Operación de pedidos y reparto

Guion para explicar y entrenar al equipo en el circuito completo: desde que entra
un pedido pagado hasta que el cliente lo recibe.

**Roles que cubre este guion**

| Rol | Dónde trabaja | Qué hace |
|---|---|---|
| Encargado de cierre | `/admin/entregas` | Arma el lote, controla stock, cierra e imprime etiquetas |
| Armado / Cocina | Mesa de armado | Prepara, empaqueta y etiqueta cada pedido |
| Repartidor | `/reparto` (celular) | Sale con la ruta y confirma cada entrega |
| Admin / Encargado general | `/admin/equipo` + todo el panel | Da de alta usuarios, supervisa y resuelve incidencias |

**Duración sugerida:** 90 minutos.
Bloque 1 (todos juntos, 20 min) → Bloques por rol (15–20 min c/u) → Simulacro (25 min).

---

## Bloque 0 — Cómo usar este guion

- Los textos en *cursiva* son **para decir en voz alta**. El resto es para vos.
- Cada rol termina con una **checklist imprimible** (sección 7). Imprimila y pegala
  en el puesto de trabajo.
- No arranques por el rol de cada uno: **arrancá siempre por el Bloque 1**. Si cada
  persona entiende el circuito completo, resuelve sola el 80% de los problemas.

---

## Bloque 1 — El recorrido de un pedido (para todos juntos)

> *"Antes de que cada uno aprenda su parte, quiero que entiendan el viaje completo
> de un pedido. Son cuatro estados, y en cada estado hay alguien responsable."*

### Los 4 estados

```
  PENDIENTE  ──►  EN PREPARACIÓN  ──►  EN CAMINO  ──►  ENTREGADO
  (el cliente     (pagó: ya es       (cerramos el     (el cliente dio
   está pagando)   nuestro trabajo)   lote y salió)    su código)
```

1. **Pendiente** — El cliente está en el checkout. Todavía no existe para nosotros.
2. **En preparación** — **Se acreditó el pago.** El pedido aparece solo en
   `/admin/entregas`, en la lista *"Cerrar pedidos para enviar"*.
3. **En camino** — El encargado cerró el lote. Se armó la ruta, se le asignó un
   repartidor y **se le avisó por WhatsApp a todos los clientes del lote**.
4. **Entregado** — Se cargó el código de 4 dígitos del cliente.

> *"Fíjense en algo importante: nosotros nunca tocamos un pedido que no esté
> pagado. Si está en la lista de Entregas, ya está pagado. Punto."*

### Los tres números que NO hay que confundir

Este es el punto donde más se equivoca la gente. Explicalo despacio.

| Número | Ejemplo | Quién lo tiene | Para qué sirve |
|---|---|---|---|
| **N° de pedido** | `#1043` | Todos. Va impreso grande en la etiqueta. | Identificar el paquete. Es el que se nombra por teléfono o WhatsApp. |
| **Código del cliente** | `4821` | **Solo el cliente.** Lo recibe en pantalla al pagar. | **Confirmar la entrega.** Es la prueba de que se entregó a la persona correcta. |
| **Lote y Parada** | `Lote A3F91C2B` / `Parada 4` | Impresos en la etiqueta. | Saber en qué viaje sale y en qué orden se entrega. |

> *"El código de 4 dígitos es el único que el repartidor NO conoce de antemano.
> No lo ve en su celular, no está en la etiqueta. Se lo tiene que pedir al cliente
> en la puerta. Eso es a propósito: es lo que garantiza que el pedido llegó a quien
> lo pagó."*

### Qué es un "lote"

> *"Un lote es un viaje. Todos los pedidos que salen juntos, con un repartidor,
> desde una sucursal. Cada vez que el encargado aprieta 'Cerrar lote', nace un
> lote nuevo con su propia ruta optimizada."*

Puntos a aclarar:

- Podés tener **varios lotes en curso al mismo tiempo** (dos repartidores en la calle).
- Mientras un lote está en la calle, **siguen entrando pedidos pagados** para el
  próximo lote. El panel te avisa: *"Hay N envíos en camino. Podés cerrar un nuevo lote."*
- Un lote **no se puede deshacer**. Por eso existe el control de stock antes de cerrar.

### Los avisos automáticos al cliente

> *"El cliente no nos llama para preguntar dónde está su pedido, porque el sistema
> le avisa solo. Ustedes no mandan nada a mano."*

- Al **cerrar el lote** → a todos los clientes del lote les llega su código de
  entrega, con la indicación de dárselo al repartidor al recibir el pedido y no
  compartirlo antes.

**Conclusión para el equipo:** confirmar cada entrega en el momento mantiene
actualizado el estado del reparto y evita errores al validar los códigos.

---

## Bloque 2 — Rol: Encargado de cierre

**Persona a cargo de:** armar el lote, controlar stock, cerrar e imprimir tickets.
**Acceso:** usuario con permiso **`entregas`**. Entra a `/admin/entregas`.

### 2.1 Preparación del puesto (una sola vez)

Esto se configura **antes** del primer cierre. Si falla, todo el flujo se traba.

1. **Configurar la impresora** en el diálogo de impresión:
   - Tamaño: **A4**
   - Márgenes: **Ninguno**
   - Escala: **100%** (nunca "Ajustar a la página")
   - Destacar: **desactivar encabezados y pies de página**
   > *"Si dejás la escala en 'ajustar', las etiquetas salen más chicas y la línea
   > de corte no coincide. Cortás mal y perdés la hoja."*
3. Dejar el navegador logueado y `/admin/entregas` como pestaña fija.

### 2.2 Paso a paso del cierre

> *"Son cinco pasos y siempre en este orden. El orden importa, ya vas a ver por qué."*

**Paso 1 — Elegir sucursal de salida y repartidor**

- Arriba de la lista hay dos desplegables: **Sucursal de salida** y **Repartidor a cargo**.
- La sucursal define **desde dónde se calcula la ruta**. Si te equivocás, la ruta
  sale mal ordenada.
- El repartidor elegido es el que va a ver esta ruta en su celular. Si elegís mal,
  la ruta le aparece a la persona equivocada.

> ⚠️ Si el desplegable dice **"No hay repartidores activos"**, no podés cerrar nada.
> Avisá al encargado general para que dé de alta un repartidor en **Equipo**
> (rol *repartidor*, con usuario y contraseña, y marcado como **Activo**).

**Paso 2 — Elegir qué pedidos entran al lote**

- La lista viene **agrupada por fecha y franja horaria** (por ejemplo, sábado a la
  mañana separado de lunes a la mañana) y, dentro de cada columna, **arriba el que pidió primero**. Se respeta el
  orden de llegada sin perder de vista el horario que eligió cada cliente.
- **Por defecto entran todos.** Tu trabajo es **destildar** los que NO salen.
- Motivos típicos para destildar:
  - La **franja horaria** del cliente es más tarde (mirá el chip amarillo con el horario).
  - No llegás con la mercadería de ese pedido.
  - La dirección quedó lejos y conviene mandarla en el próximo viaje.
- Abajo te dice siempre **"X de Y en la ruta"**. Confirmá ese número antes de seguir.

> *"Mirá el chip del horario. Si un cliente pidió de 16 a 20 y son las 10 de la
> mañana, ese pedido no entra en este lote. Destildalo."*

**Paso 3 — Controlar el stock (el modal)**

- Apretá **"Controlar stock y cerrar (N)"**.
- Se abre una ventana con dos partes:
  1. **Total a preparar** — todos los productos del lote **sumados**.
     Ej.: `Pollo entero — 14×`, `Milanesas — 6×`.
  2. **Detalle por pedido** — desplegable pedido por pedido.

> *"Este total consolidado es el momento más importante del día. Es la lista de
> compras del lote. Se la mostrás a cocina y cocina junta TODO de una sola vez,
> en lugar de ir y venir catorce veces a la cámara."*

**Acá se coordina con Armado/Cocina.** Ver Bloque 3.

- Arriba del modal te recuerda quién sale y desde dónde: *"Sale Juan desde Sucursal Centro"*.
  **Leelo en voz alta antes de confirmar.** Es tu último control.

**Paso 4 — Cerrar el lote**

- Solo cuando cocina te confirmó que **está toda la mercadería**, apretá
  **"Confirmo que hay stock, cerrar lote y armar ruta"**.
- Qué pasa en ese instante:
  - Los pedidos pasan a **en camino**.
  - Se calcula la **ruta optimizada** desde la sucursal.
  - Se le asigna el lote al repartidor (le aparece en el celular).
  - Se le avisa por WhatsApp a **todos** los clientes del lote.
  - Aparece el enlace para abrir e imprimir las etiquetas.

> ⚠️ **Esto no se puede deshacer.** Por eso el botón está después del control de stock.

**Paso 5 — Imprimir y entregar las etiquetas**

- Usá el link **"Imprimir etiquetas del reparto"** del mensaje verde de éxito.
- Formato: **A6, 4 etiquetas por hoja A4**. Cortá por la línea punteada.
- Llevá las etiquetas cortadas a la mesa de armado.

### 2.3 Por qué se imprime DESPUÉS de cerrar (explicalo, es contraintuitivo)

> *"Vas a ver que hay un botón 'Imprimir etiquetas' también ANTES de cerrar.
> No lo uses para el armado."*

**Razón:** el **N° de parada** y el **N° de lote** se calculan recién cuando cerrás.
Si imprimís antes, las etiquetas salen **sin parada y sin lote** — y son justamente
los dos datos que ordenan el trabajo de cocina y del repartidor.

- Botón *"Imprimir etiquetas"* **antes** de cerrar → solo para chusmear un pedido
  suelto o reimprimir una etiqueta puntual.
- Impresión **después** de cerrar → **la buena**, la que va al paquete.

### 2.4 Seguimiento del reparto en curso

Arriba de todo en `/admin/entregas` está el bloque **"Repartidores con rutas activas"**:
una **tarjeta por repartidor** con su nombre, su avance (*"3 de 8 entregados"*) y la
hora en que salió. De un vistazo ves quién está en la calle sin que la pantalla se
llene de rutas abiertas.

**Tocá la tarjeta del repartidor** para abrir el detalle de su reparto (se abre una
sola por vez; si tiene más de un lote en la calle, se abren los dos juntos).

Ahí ves y hacés:

- **Barra de progreso**: *"3 de 8 entregados"*. Se actualiza sola cada 15 segundos.
- **Confirmar entrega por código** — podés cargar el código vos desde el panel si
  el repartidor no puede (se quedó sin datos, se le apagó el celular).
- **El código de cada parada** — a diferencia del repartidor, **vos sí ves los
  códigos** en el panel. Sirve para destrabar cuando el cliente perdió el suyo.
- **"Ver todo" / "Solo llegando"** — filtra las paradas ya entregadas.
- El reparto se **cierra automáticamente** cuando se confirma la última entrega.
  El botón **Cerrar reparto** queda como respaldo manual.

> *"Al confirmar la última entrega, el lote desaparece de rutas activas y pasa al
> historial tanto en el panel como en el celular del repartidor."*

### 2.5 Situaciones frecuentes

| Situación | Qué hacer |
|---|---|
| Seleccioné 10 pedidos pero despachó 9 | Un pedido **no tenía ubicación en el mapa**. El sistema solo despacha pedidos con punto geográfico. Buscalo en Pedidos y resolvé la dirección con el cliente. |
| Necesito imprimir las etiquetas | El lote ya se cerró. Usá el link *"Imprimir etiquetas del reparto"* del mensaje verde. |
| Las etiquetas salen cortadas o chicas | Escala al **100%**, márgenes en **Ninguno**, sin encabezados/pies. |
| Me equivoqué de repartidor | El lote ya está cerrado. Avisale al repartidor correcto y coordiná a mano; el encargado general puede confirmar las entregas desde el panel. |
| Entró un pedido pagado justo después de cerrar | Perfecto, queda para el próximo lote. Cerrá un segundo lote cuando junte volumen. |
| Necesito reimprimir una etiqueta | Ícono de impresora al lado del pedido, o el link *Etiquetas* del reparto en curso. |

---

## Bloque 3 — Rol: Armado / Cocina

**Persona a cargo de:** preparar, empaquetar y etiquetar cada pedido.
**Herramienta:** la pantalla de control de stock del encargado + las etiquetas impresas.

> *"Vos sos el puente entre lo que la computadora dice que hay que mandar y lo que
> realmente sale por la puerta. Si vos te equivocás, el error viaja 40 minutos en
> moto antes de que alguien se dé cuenta."*

### 3.1 Momento 1 — Juntar la mercadería (antes del cierre)

1. El encargado te muestra la pantalla **"Total a preparar"** con los productos
   **sumados de todo el lote**.
2. **Juntá todo de una sola vez** contra esa lista. No armes pedido por pedido todavía.
   > *"Si dice 14 pollos, traés 14 pollos. Un solo viaje a la cámara, no catorce."*
3. Chequeá contra la lista, producto por producto, y **decile al encargado si falta algo**.
4. **Recién cuando confirmás que está todo**, el encargado cierra el lote.

> ⚠️ **Este es tu momento de decir que no.** Una vez cerrado el lote, los clientes
> ya recibieron el aviso de que su pedido salió. Si falta mercadería, se avisa
> ACÁ, antes. Nunca después.

### 3.2 Momento 2 — Armar y etiquetar (después del cierre)

1. El encargado te trae las **etiquetas cortadas**.
2. **Ordená las etiquetas por N° de Parada** (`Parada 1`, `Parada 2`, …).
3. Armá **de la última parada a la primera**. (Ya vas a ver por qué en el paso 5.)
4. Para cada pedido:
   - Leé la etiqueta: **items y cantidades** (`2× Pollo entero`, `1× Papas`).
   - Armá la bolsa.
   - **Contá los items en voz alta contra la etiqueta.** Es el control de calidad.
   - Leé la **Nota** si tiene (ahí va lo que escribió el cliente: *"sin sal"*,
     *"tocar timbre B"*).
   - **Pegá la etiqueta en la parte de afuera de la bolsa, bien visible.**
5. Cargá en el bolso del repartidor **en orden inverso**: la **Parada 1 arriba y a mano**,
   la última al fondo.
   > *"El repartidor entrega la parada 1 primero. Si la dejaste en el fondo, tiene
   > que desarmar todo el bolso en la vereda."*

### 3.3 Qué leer en la etiqueta

```
┌────────────────────────────────────┐
│ POLLERÍA ENTRE RÍOS        #1043   │  ← N° de pedido
│ Sale de Sucursal Centro   Parada 4 │  ← ORDEN DE ENTREGA
│                       Lote A3F91C2B│  ← Qué viaje es
├────────────────────────────────────┤
│ DESTINATARIO                       │
│ María González                     │
│ Tel: 343 4xx xxxx                  │
│ Horario: 16:00 a 20:00             │  ← Franja que pidió el cliente
├────────────────────────────────────┤
│ DIRECCIÓN            ┌──────────┐  │
│ Urquiza 1234, Dpto 3 │  ▓▓ QR ▓▓ │  │  ← QR: abre el punto exacto
│ Nota: tocar timbre B └──────────┘  │     en Google Maps
├────────────────────────────────────┤
│ PEDIDO                             │
│ 2×  Pollo entero                   │  ← CONTRA ESTO CONTÁS
│ 1×  Papas rústicas                 │
├────────────────────────────────────┤
│ Pago: Efectivo          $ 12.500   │  ← Cuánto cobrar (si es efectivo)
└────────────────────────────────────┘
```

### 3.4 Reglas de oro del armado

1. **Una etiqueta = una bolsa.** Nunca dos pedidos en la misma bolsa aunque sean
   de la misma cuadra.
2. **La etiqueta va afuera y visible.** El repartidor no puede abrir bolsas para
   saber cuál es cuál.
3. **Contá siempre en voz alta** contra la etiqueta antes de cerrar la bolsa.
4. **Si falta algo, se frena.** Avisá antes de que el encargado cierre el lote.
5. **La nota del cliente se lee.** Es lo único que escribió esa persona a mano.

---

## Bloque 4 — Rol: Repartidor

**Persona a cargo de:** llevar el lote y confirmar cada entrega.
**Herramienta:** el celular, en **`/reparto`**.

### 4.1 Cómo entrar (hacelo con él, en su celular)

1. Abrir el navegador del celular e ir a **`/reparto`**.
2. Iniciar sesión con **su usuario y contraseña** (se los da el encargado general).
3. **Guardar la página en la pantalla de inicio** del celular
   (menú del navegador → *"Agregar a pantalla de inicio"*). Que quede como un ícono.
4. Verificar que arriba diga **"Reparto de [su nombre]"**.

> *"Si arriba figura tu nombre, estás viendo TUS entregas. Nadie más ve tu ruta y
> vos no ves la de los demás."*

### 4.2 Qué ve en la pantalla

- **Campo grande de 4 dígitos** arriba de todo → para confirmar entregas.
- **Botón negro "Abrir ruta en Google Maps"** → abre el viaje completo, en orden.
- **Barra verde de progreso** → *"3 de 8 entregados"*.
- **Lista de paradas numeradas**, en orden. La próxima está marcada en rojo con el
  cartel **"Próximo"**.
- **El teléfono del cliente en cada parada** → tocalo y el celular marca solo.
- **Ícono de mapa** en cada parada → navega solo a esa casa.
- Abajo de todo, **"Mi historial de repartos"** → tus lotes ya cerrados. Abrís uno y
  ves todas sus paradas con el cliente, la dirección, el teléfono y la hora en que
  entregaste cada una. Solo ves **tus** lotes.
- La pantalla **se actualiza sola cada 20 segundos**. Si el local cierra otro lote,
  le aparece sin hacer nada.

### 4.3 Paso a paso de una entrega

> *"Son cuatro pasos y se repiten igual en cada casa."*

1. **Mirá cuál es la próxima.** Es la que dice *"Próximo"*. Respetá el orden: la
   ruta ya está optimizada, saltear paradas te hace perder tiempo y kilómetros.
2. **Navegá.** Dos opciones, la que te quede más cómoda:
   - Botón negro → toda la ruta en Google Maps.
   - **Escaneá el QR de la etiqueta del paquete** → te lleva al punto exacto de esa casa.
     > *"El QR es más preciso que la dirección escrita. Si la dirección es rara o
     > el barrio no tiene numeración clara, usá el QR."*
3. **Entregá y pedí el código.**
   > Decile al cliente: *"Hola, ¿me pasás el código de 4 dígitos de tu pedido?"*
   - El cliente lo tiene en la pantalla donde pagó (y en el WhatsApp).
   - **Si es pago en efectivo**, la etiqueta dice **Pago: Efectivo** y el total.
     Cobrá ese importe. Si dice Mercado Pago / Tarjeta / Transferencia, **ya está
     pagado, no cobres nada**.
4. **Cargá el código en el celular y apretá "Confirmar".**
   - Sale en verde: *"✅ Entregado a María González (#1043)"*.
   - **Confirmá en la puerta, no al final del recorrido.**

### 4.4 Situaciones en la calle

| Situación | Qué hacer |
|---|---|
| **El cliente no encuentra su código** | Está en la pantalla donde pagó y en el WhatsApp que le llegó. Si no aparece, **llamá al local**: el encargado ve el código en el panel y te lo dicta. |
| **El código no funciona** | Fijate que sea el código del cliente (4 dígitos), no el N° de pedido (`#1043`). Si sigue sin andar, llamá al local. |
| **No hay nadie en la casa** | Llamá al cliente desde la app (tocá el teléfono en la parada, marca solo). Si no atiende: **no confirmes la entrega**, seguí con la próxima parada y avisá al local. |
| **No encuentro la dirección** | Escaneá el QR de la etiqueta. Si aun así no, llamá al cliente. |
| **Me quedé sin datos / se apagó el celular** | Llamá al local. El encargado puede cargar los códigos desde el panel por vos. |
| **Confirmé una entrega equivocada** | Avisá al local **inmediatamente**. No se puede deshacer desde tu celular. |
| **Terminé todas las entregas** | El reparto se cierra solo. Después tocá **"Salir"** si el celular es compartido. |

### 4.5 Reglas de oro del repartidor

1. **Sin código no hay entrega confirmada.** Es tu respaldo y el del cliente.
2. **Confirmá en la puerta**, no al final. Cada confirmación avisa al siguiente vecino.
3. **Respetá el orden de las paradas.** La ruta ya está calculada.
4. **Nunca dejes un pedido sin que alguien lo reciba.**
5. **Ante la duda, llamá al local.** Siempre es más barato preguntar que volver.

---

## Bloque 5 — Rol: Admin / Encargado general

**Persona a cargo de:** que el sistema esté en condiciones de operar y destrabar lo
que se trabe.

### 5.1 Alta de personal (`/admin/equipo`)

Para cada integrante: **Agregar integrante** y completar

- **Nombre** y **Rol** (Cajero/a, Cocina, Repartidor/a, Encargado/a, Administrador/a).
- **Activo** tildado.
- **Usuario y contraseña** — solo si necesita entrar al sistema. Si es solo un
  contacto del equipo, dejá el usuario vacío.
- **Permisos** — qué secciones del panel ve.

**Las dos configuraciones que importan para este circuito:**

| Quién | Rol | Usuario | Permisos a marcar |
|---|---|---|---|
| Repartidor | **Repartidor/a** ← obligatorio | Sí | Ninguno (o solo *Entregas* si querés que vea el panel). Con el usuario ya entra a `/reparto`. |
| Encargado de cierre | Encargado/a o Cajero/a | Sí | **Entregas** (obligatorio) + *Pedidos* |

> ⚠️ **Un repartidor solo aparece en el desplegable de cierre si cumple las tres
> cosas: rol `repartidor`, marcado **Activo**, y con usuario y contraseña cargados.**
> Si el encargado te dice *"no me aparece Juan"*, revisá esas tres.

### 5.2 Rutina diaria de supervisión

**Apertura**

1. Entrar a `/admin/entregas` y confirmar que **hay al menos un repartidor activo**
   en el desplegable.
2. Confirmar que no quedaron **repartos en curso de ayer** sin cerrar (tarjetas de
   *Repartidores con rutas activas*). Si quedó uno, resolvé las entregas pendientes
   y cerralo.
3. Verificar que la impresora tenga papel y que el navegador del puesto de cierre
   tenga pop-ups habilitados.

**Durante el día**

- Mirar la **barra de progreso** de cada reparto en curso. Un reparto que no avanza
  hace 40 minutos es una señal: llamá al repartidor.
- Vigilar la lista de **pedidos esperando despacho**. Si se acumulan, es hora de
  cerrar otro lote.

**Cierre**

1. Que **todos los repartos en curso estén cerrados**.
2. Revisar **Historial de rutas** para ver cómo salió el día.
3. Que no queden pedidos pagados sin despachar.

### 5.3 Destrabar problemas

| Problema | Causa habitual | Solución |
|---|---|---|
| "No hay repartidores activos" | Rol mal cargado, inactivo, o sin usuario | `/admin/equipo` → rol **Repartidor/a**, **Activo**, usuario + contraseña |
| El repartidor entra y ve "No tenés entregas asignadas" | Se le cerró el lote a otro repartidor, o todavía no se cerró ninguno | Verificá en `/admin/entregas` a quién quedó asignado el lote |
| Se despacharon menos pedidos de los seleccionados | Pedidos **sin ubicación en el mapa** | Solo se despachan pedidos con punto geográfico. Contactá al cliente para corregir la dirección |
| No se puede cerrar el reparto | Quedan entregas sin confirmar | Es correcto. Confirmá las que falten con el código, o averiguá qué pasó con ese pedido |
| El cliente dice que no le llegó ningún WhatsApp | Problema del bot/n8n, no del panel | El pedido igual está en camino. Revisá la integración |
| Un repartidor ve la ruta de otro | No debería pasar | Verificá que cada uno entre con **su propio** usuario, no uno compartido |

### 5.4 Decisiones que le corresponden a este rol

- **Cuándo cerrar un lote.** No hay regla automática. El criterio: juntar volumen
  suficiente sin que los primeros pedidos se enfríen, y respetar las franjas horarias.
- **Cuántos lotes en paralelo.** Podés tener varios repartidores en la calle a la vez.
- **A quién asignarle cada zona.** El sistema optimiza la ruta, pero no decide quién sale.

---

## Bloque 6 — Simulacro (25 min)

No termines la capacitación sin esto. Hacelo con **pedidos de prueba reales** en el sistema.

**Ronda 1 — Todo bien (15 min)**

Cada uno en su puesto, un lote de 3 pedidos de punta a punta:

1. El encargado elige sucursal y repartidor, selecciona los 3, abre el control de stock.
2. Cocina junta la mercadería contra el total consolidado y confirma.
3. El encargado cierra el lote e imprime.
4. Cocina ordena por parada, arma, cuenta en voz alta y etiqueta.
5. El repartidor entra a `/reparto` desde su celular, ve las 3 paradas.
6. Simulá 3 entregas: alguien hace de cliente y dicta el código.
7. El encargado ve la barra llegar a 3 de 3 y cierra el reparto.

**Ronda 2 — Con problemas (10 min)**

Metele fallas a propósito y que las resuelvan ellos:

- Que un "cliente" **no encuentre su código** → ¿a quién llaman? (al local, que lo ve en el panel)
- Que un "cliente" **no esté en la casa** → ¿confirman igual? (**no**)
- Que cocina diga **"me faltan 2 pollos"** con el modal abierto → ¿se cierra el lote? (**no**)
- Que el repartidor quiera **confirmar todo junto al final** → ¿por qué está mal?
  (los clientes siguientes se quedan sin aviso)

**Pregunta final para todos:**
> *"¿Cuál es el único número que el repartidor NO conoce hasta que golpea la puerta?"*

Respuesta: el código de 4 dígitos del cliente. Si todos la contestan, la capacitación funcionó.

---

## Bloque 7 — Checklists imprimibles

### ☑ Encargado de cierre

```
ANTES DE CERRAR
[ ] Sucursal de salida correcta
[ ] Repartidor correcto seleccionado
[ ] Destildé los pedidos que NO salen (mirá las franjas horarias)
[ ] Leí en voz alta "Sale ___ desde ___"
[ ] Cocina me confirmó que está TODA la mercadería

CERRAR
[ ] Apreté "Confirmo que hay stock, cerrar lote y armar ruta"
[ ] Abrí las etiquetas desde el link del mensaje verde
[ ] Imprimí A4 / márgenes ninguno / escala 100%
[ ] Corté y le llevé las etiquetas a cocina

DURANTE
[ ] Miro la barra de progreso cada tanto
[ ] Cargo códigos desde el panel si el repartidor no puede

AL TERMINAR
[ ] Todas las entregas confirmadas
[ ] Apreté "Cerrar reparto"
```

### ☑ Armado / Cocina

```
ANTES DEL CIERRE
[ ] Junté TODO contra el "Total a preparar" de una sola vez
[ ] Avisé si faltaba algo (ANTES de que cierren el lote)

DESPUÉS DEL CIERRE
[ ] Ordené las etiquetas por N° de Parada
[ ] Armé de la última parada a la primera
[ ] Conté los items EN VOZ ALTA contra cada etiqueta
[ ] Leí la Nota del cliente
[ ] Pegué la etiqueta afuera y visible
[ ] Cargué con la Parada 1 arriba y a mano
```

### ☑ Repartidor

```
ANTES DE SALIR
[ ] Entré a /reparto y arriba dice MI nombre
[ ] Veo todas mis paradas
[ ] Los paquetes coinciden con las paradas de la pantalla
[ ] Celular cargado

EN CADA CASA
[ ] Voy a la parada que dice "Próximo"
[ ] Navego con el botón o con el QR de la etiqueta
[ ] Si la etiqueta dice EFECTIVO, cobro el total impreso
[ ] Le pido el código de 4 dígitos al cliente
[ ] Lo cargo y confirmo EN LA PUERTA

AL TERMINAR
[ ] Avisé al local que terminé
[ ] Toqué "Salir" si el celular es compartido
```

### ☑ Admin / Encargado general

```
APERTURA
[ ] Hay al menos un repartidor activo en el desplegable
[ ] No quedaron repartos en curso de ayer
[ ] Impresora con papel y pop-ups habilitados

DURANTE
[ ] Superviso el progreso de cada reparto
[ ] Cierro otro lote si se acumulan pedidos pagados

CIERRE
[ ] Todos los repartos cerrados
[ ] Revisé el Historial de rutas
[ ] No quedan pedidos pagados sin despachar
```

---

## Bloque 8 — Las 6 ideas que no se negocian

Si el equipo se olvida de todo lo demás, que se acuerde de esto:

1. **El código de 4 dígitos es del cliente.** Sin código no hay entrega confirmada.
2. **Se confirma en la puerta, no al final.** Cada confirmación avisa al vecino que sigue.
3. **Si falta mercadería, se avisa ANTES de cerrar el lote.** Después ya se le prometió al cliente.
4. **Las etiquetas buenas se imprimen DESPUÉS de cerrar** (son las que traen parada y lote).
5. **Se carga con la Parada 1 arriba.** El repartidor entrega en ese orden.
6. **Ante la duda, se llama al local.** El panel ve cosas que el repartidor no.
