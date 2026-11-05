# Spec Delta

## Purpose

Cruza el movimiento del suelo con pendiente, infraestructura, población y uso de suelo, para mostrar qué y quién está sobre las zonas que cambian, sin evaluar daños.

## ADDED Requirements

### Requirement: Pendiente y laderas activas
La UI SHALL ofrecer una capa de pendiente en grados, calculada del DEM, y una capa de laderas activas que marque terreno empinado donde además hay movimiento detectado.

#### Scenario: Ladera activa
- **WHEN** un terreno con más de 15° de pendiente tiene más de 1 cm/año de movimiento
- **THEN** se marca como ladera activa

#### Scenario: Terreno plano
- **WHEN** un terreno plano se mueve
- **THEN** no se marca como ladera activa

### Requirement: Infraestructura sobre zonas de cambio
La UI SHALL dibujar caminos principales y canales sobre el terreno y resaltar los tramos dentro de una zona de hundimiento o con hundimiento diferencial alto en la fecha seleccionada, indicando los km afectados.

#### Scenario: Tramo resaltado
- **WHEN** un canal cruza una zona de hundimiento alto
- **THEN** ese tramo se resalta y cambia con la fecha

#### Scenario: Tocar un tramo
- **WHEN** el usuario toca un camino o canal
- **THEN** el inspector muestra su nombre si lo tiene, su tipo y el cambio del terreno en ese tramo

### Requirement: Población expuesta
La UI SHALL ofrecer una capa de población estimada y mostrar en cada etiqueta de zona las personas estimadas dentro de ella, redondeadas y marcadas como aproximadas.

#### Scenario: Personas en una zona
- **WHEN** una zona principal cubre áreas pobladas
- **THEN** su etiqueta muestra "≈ N personas"

#### Scenario: Zona sin población
- **WHEN** una zona no tiene población estimada
- **THEN** su etiqueta no muestra personas

### Requirement: Uso de suelo
La UI SHALL ofrecer una capa de uso de suelo y mostrar en el inspector y en las etiquetas de zona el tipo predominante.

#### Scenario: Zona agrícola
- **WHEN** una zona cae sobre todo en cultivos
- **THEN** su etiqueta indica que es principalmente cultivo

### Requirement: Lenguaje sin evaluación de daño
Las capas de impacto SHALL indicar que muestran exposición, no daño ni riesgo confirmado, y SHALL evitar términos como "en peligro".

#### Scenario: Ayuda de impacto
- **WHEN** el usuario abre la ayuda de una capa de impacto
- **THEN** se explica que señala qué está encima de una zona de cambio, sin afirmar daño
