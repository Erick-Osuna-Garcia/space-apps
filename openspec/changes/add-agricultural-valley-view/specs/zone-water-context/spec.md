# Spec Delta

## Purpose

Relaciona cada zona agrícola con los canales, ríos y cuerpos de agua cercanos, como contexto del territorio y no como un modelo de riego.

## ADDED Requirements

### Requirement: Canal o río más cercano
Con una zona elegida, el sistema SHALL indicar la vía de agua más cercana, si es canal o río, su nombre cuando exista y la distancia. Si no tiene nombre, SHALL decir que no está nombrada.

#### Scenario: Canal con nombre
- **WHEN** la vía más cercana es un canal con nombre
- **THEN** la ficha muestra que es un canal, su nombre y la distancia

#### Scenario: Río sin nombre
- **WHEN** la vía más cercana es un río sin nombre
- **THEN** la ficha la identifica como río y dice que no tiene nombre

#### Scenario: Nada cerca
- **WHEN** no hay canal ni río dentro de la distancia que indica la ayuda
- **THEN** la ficha dice que no encontró una vía cercana y no afirma que la zona carezca de derecho de agua

### Requirement: Cuerpos de agua de la fecha
El sistema SHALL decir si la capa de agua marca agua permanente o agua nueva en contacto con la zona, o junto a ella, en la fecha activa.

#### Scenario: Agua nueva junto a la zona
- **WHEN** la fecha activa marca agua nueva junto a la zona
- **THEN** la ficha la distingue del agua permanente

#### Scenario: Sin agua en la zona
- **WHEN** la capa de agua no marca agua en ni junto a la zona
- **THEN** la ficha dice que no hay cuerpo de agua medido ahí en esa fecha

### Requirement: No inventar ríos
Si el territorio no trae ríos, el sistema SHALL seguir mostrando canales y cuerpos de agua y SHALL NOT inventar un río. Si trae ríos, SHALL leerlos igual que los canales y SHALL etiquetarlos como río.

#### Scenario: Sin ríos en los datos
- **WHEN** los overlays no incluyen ríos
- **THEN** la lectura de cercanía usa canales y cuerpos de agua, sin nombrar un río

### Requirement: La cercanía no es riego
El texto de contexto hídrico SHALL decir que la cercanía es contexto territorial y SHALL NOT presentarla como prueba de que la zona se riega o recibe agua de esa vía.

#### Scenario: Ver el contexto
- **WHEN** la ficha muestra una vía o un cuerpo de agua cercano
- **THEN** incluye la aclaración de que no demuestra riego ni suministro

### Requirement: Resaltar la vía usada
El mapa SHALL distinguir visualmente la vía de agua que la ficha está usando para la zona elegida.

#### Scenario: Zona con canal cercano
- **WHEN** hay una zona elegida y una vía dentro de la distancia de la ayuda
- **THEN** esa vía se distingue de las demás en el mapa
