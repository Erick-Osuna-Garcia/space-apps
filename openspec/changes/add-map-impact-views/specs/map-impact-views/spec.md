# Spec Delta

## Purpose

Muestra el impacto de los cambios de superficie directamente sobre el mapa, con zonas y vistas que se entienden sin leer gráficas ni saber de radar.

## ADDED Requirements

### Requirement: Selector de vistas
Con una capa de desplazamiento visible, la UI SHALL ofrecer un selector con una sola vista activa a la vez: Acumulado, Velocidad, Zonas, Diferencial y Aceleración. Al cambiar de vista, el mapa, la leyenda y la sonda SHALL mostrar esa vista. La vista por defecto SHALL ser Acumulado.

#### Scenario: Cambiar de vista
- **WHEN** el usuario elige la vista Zonas
- **THEN** el mapa muestra las zonas y la leyenda y la sonda pasan a explicar esa vista

#### Scenario: Región sin capa
- **WHEN** la región activa no tiene capas
- **THEN** el selector no se muestra

#### Scenario: Hundimiento 3D combinado
- **WHEN** el hundimiento 3D está activo y el usuario cambia de vista
- **THEN** el relieve sigue hundido y solo cambia lo que se pinta sobre él

### Requirement: Zonas más bajas y más altas
La vista Zonas SHALL dividir el terreno según el desplazamiento de la fecha seleccionada en zonas más bajas (hundimiento bajo de 2 a 5 cm, medio de 5 a 10 cm y alto de más de 10 cm), zonas más altas (más de 2 cm hacia el satélite) y sin cambio. Cada tipo SHALL tener color y nombre propios, y los píxeles sin dato SHALL seguir viéndose como sin dato.

#### Scenario: Zonas a la fecha
- **WHEN** la vista Zonas está activa en una fecha con hundimiento de 12 cm en Cerro Prieto
- **THEN** ese lugar aparece como zona de hundimiento alto, rodeado por las zonas media y baja

#### Scenario: Zona más alta
- **WHEN** un área se acercó al satélite más de 2 cm
- **THEN** aparece como zona más alta, con un color distinto al de las zonas hundidas

#### Scenario: Primera fecha
- **WHEN** está seleccionada la primera fecha
- **THEN** no hay zonas y la leyenda indica que todavía no hay cambio

#### Scenario: Ruido aislado
- **WHEN** un grupo de píxeles forma un área menor a 1 km²
- **THEN** no se marca como zona

### Requirement: Contornos que crecen
La vista Zonas SHALL dibujar el contorno de cada zona sobre el terreno, actualizado con la fecha seleccionada, para que la expansión se vea al reproducir la línea de tiempo.

#### Scenario: Reproducir zonas
- **WHEN** la vista Zonas está activa y se reproduce la línea de tiempo
- **THEN** los contornos se expanden o se contraen fecha a fecha

### Requirement: Marcador del punto extremo
En la vista Zonas, cada zona principal SHALL tener un marcador sobre el terreno en su punto de mayor desplazamiento, que se mueve con la fecha. Se muestran como máximo las 5 zonas de mayor área.

#### Scenario: Marcador de zona
- **WHEN** la vista Zonas está activa
- **THEN** cada zona principal muestra un marcador en su punto extremo, siguiendo la superficie aunque esté activo el hundimiento 3D

#### Scenario: Volar al marcador
- **WHEN** el usuario selecciona la etiqueta de una zona
- **THEN** la nave vuela al marcador de esa zona

### Requirement: Etiqueta de velocidad de la zona
Cada zona principal SHALL mostrar una etiqueta flotante con su tipo y su velocidad media en cm/año, calculada sobre sus píxeles válidos. Si la velocidad no se puede calcular, la etiqueta SHALL indicarlo.

#### Scenario: Etiqueta visible
- **WHEN** la zona principal baja a −8 cm/año de media
- **THEN** su etiqueta muestra el tipo de zona y "−8.0 cm/año"

### Requirement: Vista de hundimiento diferencial
La vista Diferencial SHALL pintar cuánto cambia el desplazamiento entre puntos cercanos, en cm por km, para la fecha seleccionada. La leyenda y la ayuda SHALL explicar que señala dónde el terreno se dobla y que no es una evaluación de daño.

#### Scenario: Borde del cuenco
- **WHEN** la vista Diferencial está activa sobre el cuenco de Cerro Prieto
- **THEN** los bordes del cuenco se resaltan más que su centro y que el terreno sin cambio

#### Scenario: Cerca de sin dato
- **WHEN** un píxel no tiene vecinos válidos suficientes
- **THEN** se muestra como sin dato

### Requirement: Vista de aceleración
La vista Aceleración SHALL comparar la velocidad de la primera y la segunda mitad de la serie y pintar dónde el hundimiento se acelera y dónde se frena, en cm/año. La ayuda SHALL advertir que, con menos de dos años de datos, puede reflejar ciclos estacionales.

#### Scenario: Zona que se acelera
- **WHEN** un punto se hunde más rápido en la segunda mitad de la serie
- **THEN** se pinta en el color de "acelera"

#### Scenario: Serie corta
- **WHEN** la capa tiene menos de 4 fechas
- **THEN** la vista no está disponible y se explica por qué

### Requirement: Sonda y leyenda por vista
La sonda SHALL mostrar el valor de la vista activa bajo la nave en lenguaje claro, y la leyenda SHALL mostrar sus colores, unidades y significado.

#### Scenario: Sonda sobre una zona
- **WHEN** la nave está sobre una zona de hundimiento alto en la vista Zonas
- **THEN** la sonda muestra "Zona de hundimiento alto" además del valor en cm

### Requirement: Rendimiento de las vistas
Cambiar de vista o de fecha SHALL mantener el pilotaje fluido, sin congelar la interfaz.

#### Scenario: Reproducir en Zonas
- **WHEN** se reproduce la línea de tiempo con la vista Zonas activa
- **THEN** la nave se sigue moviendo sin saltos perceptibles

### Requirement: Experiencia inicial animada
Al entrar a una región con capa, el mapa SHALL empezar con el hundimiento 3D activo en ×10,000 y reproducir la línea de tiempo sola en bucle en cuanto la capa esté cargada, sin tocar play. El usuario SHALL poder pausar o desactivar el 3D. Con `prefers-reduced-motion` no SHALL iniciar la reproducción automática.

#### Scenario: Entrada a la app
- **WHEN** el usuario abre el explorador y termina de cargar la capa
- **THEN** el terreno se deforma fecha a fecha sin ninguna acción

#### Scenario: Movimiento reducido
- **WHEN** el navegador tiene `prefers-reduced-motion`
- **THEN** la línea de tiempo queda en pausa hasta que el usuario presione play

### Requirement: Fecha visible en el mapa
Mientras haya línea de tiempo, la UI SHALL mostrar justo encima de ella la fecha seleccionada como un título grande de estilo juego, con el tiempo transcurrido como subtítulo. Cada fecha SHALL permanecer unos 3 segundos durante la reproducción, con una transición suave del terreno.

#### Scenario: Fecha durante la reproducción
- **WHEN** la línea de tiempo avanza
- **THEN** el título y su subtítulo cambian junto con la deformación del terreno
