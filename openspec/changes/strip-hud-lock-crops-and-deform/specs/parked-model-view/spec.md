# Spec Delta

## Purpose

Muestra, en un recuadro aparte del mapa, el modelo 3D del objeto más cercano a la nave cuando esta está parada, sin un menú de catálogo ni un vuelo automático.

## ADDED Requirements

### Requirement: View dedicado al parar
Cuando la nave está en reposo sobre Mexicali y hay un modelo de mapa a distancia de sondeo, la interfaz SHALL mostrar ese modelo 3D (cultivo, casa, edificio o auto) en un recuadro dedicado, fuera del lienzo isométrico.

#### Scenario: Nave parada sobre un cultivo
- **WHEN** la nave deja de moverse junto a un modelo de cultivo
- **THEN** el recuadro muestra ese cultivo en 3D con su nombre

#### Scenario: Nave parada sobre asentamiento
- **WHEN** la nave deja de moverse junto a una casa o un edificio
- **THEN** el recuadro muestra ese modelo, no un cultivo lejano

### Requirement: Vacío en movimiento o sin modelo
Mientras la nave se mueve, o si está parada lejos de cualquier modelo, el recuadro SHALL NOT mostrar un GLB de catálogo elegido a mano. SHALL indicar que no hay modelo bajo la nave.

#### Scenario: En vuelo
- **WHEN** la nave tiene velocidad distinta de cero
- **THEN** el recuadro no exhibe un modelo 3D del catálogo

#### Scenario: Desierto
- **WHEN** la nave está parada en una celda sin modelo cercano
- **THEN** el recuadro explica que no hay modelo en ese punto

### Requirement: Sin menú de modelos
La persona SHALL NOT elegir un modelo de una lista ni hacer que la nave vuele a un grupo al tocar el recuadro.

#### Scenario: Sin catálogo
- **WHEN** la persona busca el menú Modelos o una lista de cultivos para volar
- **THEN** no hay lista ni acción de vuelo ligada al recuadro
