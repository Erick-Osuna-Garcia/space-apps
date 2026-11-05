# Spec Delta

## Purpose

Superpone sobre el terreno capas de cambio de superficie derivadas de NISAR, navegables en el tiempo y explicadas con contexto, para que cualquier persona entienda qué cambió, cuánto y por qué.

## ADDED Requirements

### Requirement: Capa de subsidencia sobre el terreno
Cuando la región activa tiene una capa de subsidencia, el terreno SHALL colorearse según el desplazamiento LOS acumulado de la fecha seleccionada, con una escala divergente centrada en 0 cm. Los píxeles sin dato SHALL verse con un color neutro distinguible.

#### Scenario: Capa visible
- **WHEN** el usuario está en Mexicali con la capa de subsidencia activa
- **THEN** el terreno alrededor de Cerro Prieto se colorea según el desplazamiento de la fecha seleccionada

#### Scenario: Sin dato
- **WHEN** un píxel está marcado como sin dato en el manifiesto
- **THEN** ese píxel se muestra en el color neutro de "sin dato", no con un color de la escala

### Requirement: Activar y desactivar capas
El usuario SHALL poder mostrar u ocultar cada capa disponible y ajustar su opacidad. Con la capa oculta, el terreno se muestra con su sombreado base.

#### Scenario: Ocultar capa
- **WHEN** el usuario desactiva la capa de subsidencia
- **THEN** el terreno vuelve al sombreado base y la leyenda de la capa se oculta

### Requirement: Línea de tiempo
La UI SHALL mostrar un slider con las fechas de la capa activa y un botón de reproducción que recorre las fechas en orden y en bucle. Al cambiar de fecha, la coloración SHALL actualizarse con una transición suave.

#### Scenario: Reproducción
- **WHEN** el usuario presiona reproducir
- **THEN** la fecha avanza automáticamente, la coloración se actualiza y la fecha actual se muestra en texto

#### Scenario: Selección manual
- **WHEN** el usuario arrastra el slider a una fecha
- **THEN** la reproducción se pausa y se muestra esa fecha

### Requirement: Leyenda con unidades
Mientras una capa está visible, la UI SHALL mostrar su leyenda con la escala de color, las unidades (cm), el significado del signo (alejamiento/acercamiento al satélite en LOS) y el rango de valores.

#### Scenario: Leyenda de subsidencia
- **WHEN** la capa de subsidencia está visible
- **THEN** la leyenda muestra la escala en cm y explica que los valores negativos indican alejamiento del satélite (hundimiento)

### Requirement: Estado de la nave
La UI SHALL mostrar un tablero de la nave con su estado de vuelo, velocidad, rumbo, altura del terreno y ubicación, y un sensor de suelo con el valor de la capa activa bajo la nave en la fecha seleccionada.

#### Scenario: Nave en vuelo
- **WHEN** la nave se mueve hacia el norte
- **THEN** el tablero indica "En vuelo", su velocidad y el rumbo N

#### Scenario: Sobrevuelo de Cerro Prieto
- **WHEN** la nave está sobre un píxel válido de la capa
- **THEN** el sensor de suelo muestra el desplazamiento en cm de la fecha actual y su nivel de tendencia

#### Scenario: Sobre píxel sin dato
- **WHEN** la nave está sobre un píxel sin dato
- **THEN** el sensor indica que no hay lectura porque el radar perdió coherencia

### Requirement: Contexto narrativo
La UI SHALL ofrecer un panel que explique qué es SAR/InSAR, cómo se lee la capa, la hipótesis física del cambio (extracción de fluidos geotérmicos en Cerro Prieto) y aplicaciones futuras de NISAR.

#### Scenario: Abrir contexto
- **WHEN** el usuario abre el panel de contexto
- **THEN** se muestran las explicaciones sin bloquear el pilotaje de la nave

### Requirement: Créditos y procedencia de datos
La UI SHALL mostrar los créditos de cada fuente (NASA/ISRO NISAR vía ASF DAAC, Copernicus DEM) y los ids de los productos usados, tomados del manifiesto.

#### Scenario: Ver procedencia
- **WHEN** el usuario abre los créditos
- **THEN** ve cada fuente con su atribución y la lista de productos NISAR usados en la capa activa

### Requirement: Aviso de datos no NISAR
Cuando el manifiesto marca una capa como sintética o derivada de un sensor distinto a NISAR, la UI SHALL mostrar un aviso discreto y permanente mientras la capa esté activa, que indique el origen real de los datos, con una ayuda que lo explique. La UI MUST NOT presentar esa capa como medición NISAR.

#### Scenario: Capa sintética
- **WHEN** la capa activa tiene origen `synthetic` en el manifiesto
- **THEN** la UI muestra la etiqueta "Datos simulados" y su ayuda aclara que no son mediciones NISAR

#### Scenario: Capa de respaldo Sentinel-1
- **WHEN** la capa activa tiene origen `sentinel-1` en el manifiesto
- **THEN** la UI muestra un aviso que identifica a Sentinel-1 como la fuente de esa capa

### Requirement: Modelo de capas extensible
Cada capa SHALL describirse en el manifiesto con un tipo, sus unidades, su escala de color y sus fechas. Agregar una capa nueva de un tipo ya soportado no SHALL requerir cambios de código, y la UI SHALL ignorar con un aviso las capas de tipos que no soporta.

#### Scenario: Tipo desconocido
- **WHEN** el manifiesto incluye una capa de un tipo no soportado
- **THEN** la app la omite, registra un aviso en consola y el resto de la escena funciona normalmente

### Requirement: Modo velocidad
Para capas de desplazamiento, el usuario SHALL poder alternar la coloración entre "acumulado" (cm a la fecha seleccionada) y "velocidad" (cm/año, tendencia lineal por píxel sobre todas las fechas). La leyenda y la sonda SHALL reflejar el modo y las unidades activas.

#### Scenario: Cambiar a velocidad
- **WHEN** el usuario elige el modo "velocidad"
- **THEN** el terreno se colorea por cm/año, la leyenda muestra la escala en cm/año y la línea de tiempo indica que la velocidad no depende de la fecha

#### Scenario: Volver a acumulado
- **WHEN** el usuario vuelve al modo "acumulado"
- **THEN** la coloración vuelve a depender de la fecha seleccionada

### Requirement: Hundimiento 3D exagerado
El usuario SHALL poder activar un modo opcional que desplaza verticalmente la superficie según el desplazamiento acumulado de la fecha seleccionada, multiplicado por un factor de exageración visible. El panel de capas SHALL mostrar el factor aplicado y su ayuda SHALL indicar que es una exageración ilustrativa. La nave y los puntos de interés SHALL seguir la superficie desplazada.

#### Scenario: Activar exageración
- **WHEN** el usuario activa "hundimiento 3D" con factor ×5000
- **THEN** el cuenco de Cerro Prieto se hunde visualmente, el panel muestra el factor ×5000 y la nave vuela sobre la superficie desplazada

#### Scenario: Reproducir en 3D
- **WHEN** el modo está activo y el usuario reproduce la línea de tiempo
- **THEN** la superficie baja progresivamente fecha a fecha con transición suave

#### Scenario: Píxeles sin dato
- **WHEN** un píxel sin dato está a menos de ~1 km de píxeles válidos
- **THEN** su geometría toma el desplazamiento interpolado de esos vecinos, para no crear paredes artificiales, pero se sigue pintando con el color de "sin dato"

#### Scenario: Huecos grandes sin dato
- **WHEN** un píxel sin dato está a más de ~1 km de cualquier píxel válido
- **THEN** no se desplaza (se queda a la altura del relieve)

### Requirement: Estado del punto en lenguaje claro
El tablero de la nave SHALL resumir la tendencia del punto bajo la nave con una etiqueta en palabras (estable, se hunde lento, moderado o rápido, se acerca al satélite) que combine ícono, texto y color. Los cortes de cada nivel SHALL poder consultarse en la ayuda, que SHALL aclarar que son orientativos y no una evaluación de riesgo.

#### Scenario: Punto que se hunde rápido
- **WHEN** la nave está sobre un punto con tendencia de −12 cm/año
- **THEN** el tablero muestra la etiqueta "Se hunde rápido" junto al valor numérico

#### Scenario: Punto estable
- **WHEN** la tendencia del punto está entre −1 y +1 cm/año
- **THEN** el tablero muestra la etiqueta "Estable"

#### Scenario: Punto sin dato
- **WHEN** el punto no tiene tendencia calculable
- **THEN** el tablero muestra "Sin lectura" y explica que el radar perdió coherencia ahí

### Requirement: Comparaciones cotidianas
La UI SHALL acompañar el valor del sensor de suelo con una comparación cotidiana del desplazamiento con un objeto de tamaño conocido.

#### Scenario: Hundimiento con objeto
- **WHEN** el sensor de suelo muestra un hundimiento de 13 cm
- **THEN** se muestra una comparación con un objeto de tamaño similar

### Requirement: Ubicación entendible
El tablero de la nave SHALL indicar el punto de interés más cercano de la región y su distancia en km, además de las coordenadas. Cuando la nave esté a menos de 1 km SHALL indicar que está sobre ese punto.

#### Scenario: Cerca de un punto de interés
- **WHEN** la nave está a 3.2 km de la planta Cerro Prieto y ese es el punto más cercano
- **THEN** el tablero muestra "A 3.2 km de Planta geotérmica Cerro Prieto"

#### Scenario: Sobre un punto de interés
- **WHEN** la nave está a menos de 1 km de un punto de interés
- **THEN** el tablero muestra "Sobre" seguido del nombre del punto

### Requirement: Ayuda contextual en cada panel
Cada panel de datos (destinos, capas, estado de la nave y línea de tiempo) SHALL ofrecer un botón de ayuda con una explicación corta en lenguaje sencillo, operable con ratón, teclado y pantalla táctil, y SHALL no impedir pilotar la nave.

#### Scenario: Abrir ayuda
- **WHEN** el usuario activa el botón de ayuda de un panel
- **THEN** aparece la explicación junto al panel y se cierra con Escape o al tocar fuera

### Requirement: Tiempo transcurrido
La línea de tiempo SHALL mostrar en palabras cuánto tiempo pasó entre la primera fecha y la fecha seleccionada.

#### Scenario: Fecha avanzada
- **WHEN** la fecha seleccionada está a 6 meses de la primera
- **THEN** la línea de tiempo muestra "6 meses desde el inicio"

#### Scenario: Primera fecha
- **WHEN** está seleccionada la primera fecha
- **THEN** la línea de tiempo muestra "Fecha inicial"
