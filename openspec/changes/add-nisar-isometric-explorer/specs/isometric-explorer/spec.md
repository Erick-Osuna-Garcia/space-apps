# Spec Delta

## Purpose

Ofrece una escena 3D isométrica del terreno real por regiones, que el usuario recorre pilotando una nave, para explorar de forma lúdica los lugares donde NISAR mide cambios de superficie.

## ADDED Requirements

### Requirement: Escena de terreno isométrica
La página principal SHALL mostrar el terreno de la región activa en 3D, con proyección ortográfica y ángulo isométrico fijo. El relieve se construye a partir del heightmap del manifiesto, con una exageración vertical que se indica en la UI.

#### Scenario: Carga inicial
- **WHEN** el usuario abre la página principal
- **THEN** se muestra la región por defecto (Mexicali) en vista isométrica con la nave sobre el terreno

#### Scenario: Exageración vertical visible
- **WHEN** la escena está renderizada
- **THEN** la UI muestra el factor de exageración vertical aplicado al relieve

### Requirement: Renderizado solo en cliente
La escena 3D SHALL renderizarse solo en el navegador. El servidor SHALL entregar un estado de carga que no dependa de WebGL.

#### Scenario: Navegador sin WebGL
- **WHEN** el navegador no soporta WebGL
- **THEN** la página muestra un mensaje explicativo y el contexto narrativo en lugar de la escena

### Requirement: Pilotaje con teclado
El usuario SHALL poder mover la nave con WASD o con las flechas, en direcciones relativas a la vista isométrica. La nave SHALL mantenerse a una altura constante sobre el terreno y no podrá salir del bbox de la región.

#### Scenario: Avance
- **WHEN** el usuario mantiene presionada `W` o la flecha arriba
- **THEN** la nave avanza hacia el fondo de la pantalla y sigue el relieve sin atravesarlo

#### Scenario: Borde de región
- **WHEN** la nave llega al borde del bbox de la región
- **THEN** se detiene en el borde y no sale del terreno

### Requirement: Vuelo por clic o tap
Al hacer clic o tap sobre un punto del terreno, la nave SHALL volar a ese punto con movimiento suavizado. Así el pilotaje funciona en pantallas táctiles sin teclado.

#### Scenario: Tap en móvil
- **WHEN** el usuario toca un punto del terreno en una pantalla táctil
- **THEN** la nave vuela a ese punto y se detiene ahí

### Requirement: Cámara de seguimiento
La cámara SHALL seguir a la nave manteniendo el ángulo isométrico, y el usuario SHALL poder acercar o alejar el zoom dentro de límites definidos.

#### Scenario: Zoom
- **WHEN** el usuario usa la rueda del ratón o el gesto de pellizco
- **THEN** el zoom cambia dentro de sus límites sin alterar el ángulo isométrico

### Requirement: Puntos de interés y warp entre regiones
La UI SHALL listar puntos de interés del manifiesto: al menos la planta geotérmica Cerro Prieto, la ciudad de Mexicali y Tijuana. Al elegir uno, la nave SHALL viajar a él. Si el punto pertenece a otra región, se carga esa región con una transición de "warp".

#### Scenario: Warp a Tijuana
- **WHEN** el usuario está en Mexicali y elige "Tijuana"
- **THEN** se muestra la transición de warp, se carga el terreno de Tijuana y la nave aparece sobre el punto elegido

#### Scenario: Región sin capas
- **WHEN** la región activa no tiene capas de cambio de superficie
- **THEN** la UI indica que los fenómenos de esa región llegarán próximamente y la escena muestra solo el terreno

### Requirement: Rendimiento
La escena SHALL mantener una experiencia fluida en una laptop de gama media (objetivo: 50 FPS o más) y SHALL ser usable en móviles recientes.

#### Scenario: Interacción continua
- **WHEN** el usuario pilota la nave durante 30 segundos con una capa activa en una laptop de gama media
- **THEN** la tasa de cuadros se mantiene en 50 FPS o más la mayor parte del tiempo
