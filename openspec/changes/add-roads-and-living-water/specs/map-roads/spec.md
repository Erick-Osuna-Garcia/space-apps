# Spec Delta

## Purpose

Define cómo se dibujan caminos y canales sobre el terreno para que se lean como un mapa, distingan el tipo de vía y mantengan visibles los tramos afectados.

## ADDED Requirements

### Requirement: Ancho según el tipo de vía
Cada vía SHALL dibujarse como una cinta con borde oscuro y un ancho según su tipo, de mayor a menor: autopista, troncal, primaria y secundaria. Los canales SHALL dibujarse como cintas de color agua.

#### Scenario: Vías de distinto tipo
- **WHEN** una autopista y una vía secundaria aparecen en pantalla
- **THEN** la autopista se ve más ancha que la secundaria

#### Scenario: Curvas
- **WHEN** una vía cambia de dirección
- **THEN** la cinta se ve continua, sin huecos en la unión

### Requirement: Legibilidad a cualquier zoom
Las cintas SHALL conservar un ancho mínimo en pantalla para seguir siendo legibles al alejarse.

#### Scenario: Vista de toda la región
- **WHEN** el usuario se aleja al máximo
- **THEN** las vías visibles siguen distinguiéndose del terreno

### Requirement: Detalle según el zoom
Las vías SHALL aparecer con un desvanecido según el zoom: autopistas y troncales siempre, primarias y canales a media distancia, y secundarias al acercarse.

#### Scenario: Vista lejana
- **WHEN** se ve toda la región
- **THEN** solo se ven autopistas, troncales y tramos afectados

#### Scenario: Vista inicial
- **WHEN** el usuario entra al mapa
- **THEN** se ven todos los tipos de vía

### Requirement: Tramos afectados siempre visibles
Los tramos en zonas de cambio SHALL verse resaltados a cualquier zoom, sea cual sea su tipo.

#### Scenario: Secundaria afectada de lejos
- **WHEN** una vía secundaria tiene un tramo afectado y se ve toda la región
- **THEN** ese tramo se ve resaltado aunque el resto de la vía esté oculto

### Requirement: Vías pegadas al terreno
Las cintas SHALL seguir el relieve y el hundimiento 3D con la misma transición que el terreno.

#### Scenario: Cambio de fecha con hundimiento 3D
- **WHEN** cambia la fecha con el hundimiento 3D activo
- **THEN** las vías bajan junto con el terreno, sin saltos ni separarse de él

#### Scenario: Vía sobre una loma
- **WHEN** un tramo largo cruza un cambio de relieve
- **THEN** la cinta no queda enterrada ni flotando

### Requirement: Fluidez del mapa
Dibujar las vías SHALL NOT volver a causar lag al hacer zoom, y las vías SHALL NOT interceptar los clics sobre el terreno.

#### Scenario: Clic sobre una vía
- **WHEN** el usuario toca el mapa encima de una vía
- **THEN** la nave vuela a ese punto como en cualquier otro lugar del terreno
