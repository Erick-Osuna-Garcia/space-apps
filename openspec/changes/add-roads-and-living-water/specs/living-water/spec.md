# Spec Delta

## Purpose

Hace que el agua del mapa se vea viva y reaccione a la nave, mostrando por fecha la extensión medida sin presentar la animación como si fuera una medición.

## ADDED Requirements

### Requirement: Superficie animada
Las celdas con agua SHALL verse con oleaje suave y brillo del sol, con bordes suavizados en lugar de cuadros de celda. Las manchas de una sola celda SHALL NOT dibujarse como agua.

#### Scenario: Lago en la vista inicial
- **WHEN** hay un lago en pantalla y ninguna capa tiene dato en sus celdas
- **THEN** se ve agua animada, aunque la capa activa marque esas celdas como sin dato

#### Scenario: Celda aislada
- **WHEN** una sola celda aislada está clasificada como agua nueva
- **THEN** no se dibuja como superficie de agua

### Requirement: La capa activa conserva sus datos
Donde la capa activa tenga dato, su color SHALL prevalecer sobre la superficie de agua.

#### Scenario: Agua nueva con dato de desplazamiento
- **WHEN** una celda tiene agua y también valor en la capa activa
- **THEN** se ve el color de la capa

### Requirement: Extensión según la fecha
La extensión del agua SHALL corresponder a la medición NISAR más reciente que no sea posterior a la fecha seleccionada, y SHALL cambiar con una transición.

#### Scenario: Avance del timeline
- **WHEN** la fecha pasa a una con más agua nueva
- **THEN** el agua aparece de forma gradual en esas zonas

#### Scenario: Fecha sin medición de agua
- **WHEN** la fecha seleccionada no tiene medición de agua propia
- **THEN** se muestra la medición anterior más cercana

### Requirement: Agua nueva distinguible
El agua nueva SHALL verse distinta de la permanente, para no presentarla como un cuerpo de agua confirmado.

#### Scenario: Ambas en pantalla
- **WHEN** hay agua permanente y agua nueva a la vista
- **THEN** el agua nueva se ve más clara y traslúcida

### Requirement: Reacción a la nave
Cuando la nave se mueve sobre agua visible SHALL dejar ondas que se expanden y desaparecen.

#### Scenario: Cruzar un lago
- **WHEN** la nave se mueve sobre agua
- **THEN** deja una estela de ondas detrás

#### Scenario: Nave detenida o sobre tierra
- **WHEN** la nave está detenida o sobre tierra
- **THEN** no genera ondas nuevas

### Requirement: Reacción al toque
Tocar el agua SHALL crear una onda en ese punto, además de la acción normal de volar ahí.

#### Scenario: Toque en un lago
- **WHEN** el usuario toca una celda con agua
- **THEN** nace una onda en ese punto y la nave vuela ahí

### Requirement: Control de la animación
Ajustes SHALL ofrecer un interruptor para la animación del agua, encendido por defecto. Con la animación apagada o con movimiento reducido, el agua SHALL verse quieta y sin ondas, y la extensión SHALL seguir cambiando con la fecha.

#### Scenario: Movimiento reducido
- **WHEN** el sistema pide reducir el movimiento
- **THEN** el agua no se anima ni genera ondas, y sigue mostrando la extensión de la fecha

#### Scenario: Apagar en Ajustes
- **WHEN** el usuario apaga "Agua animada"
- **THEN** el oleaje y las ondas se detienen

### Requirement: Aclaración de lo medido
Ajustes SHALL aclarar que la extensión viene de las mediciones y que el oleaje y las ondas son decorativos.

#### Scenario: Abrir Ajustes
- **WHEN** el usuario ve el interruptor de agua animada
- **THEN** lee esa aclaración junto a él

### Requirement: Carga sin bloqueo
El mapa SHALL ser usable antes de que lleguen los datos de agua, y un fallo al cargarlos SHALL NOT impedir su uso.

#### Scenario: Datos de agua no disponibles
- **WHEN** la carga del cubo de agua falla
- **THEN** el mapa funciona con el color de agua actual
