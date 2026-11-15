# Spec Delta

## Purpose

Deja el mapa a la vista: quita los menús y paneles flotantes de herramientas para que solo queden el valle, la línea de tiempo y el recuadro del modelo.

## ADDED Requirements

### Requirement: Sin menús flotantes de herramientas
La interfaz SHALL NOT mostrar paneles ni botones flotantes para Cultivos, Eventos, Modelos, Contexto, Créditos, Capas ni Destinos. SHALL NOT mostrar el inspector de un toque en el mapa ni el dock de esas herramientas en teléfono.

#### Scenario: Vista de escritorio
- **WHEN** la persona abre el explorador en un viewport amplio
- **THEN** no hay botones Cultivos, Eventos, Modelos, Contexto, Créditos, Capas ni lista de destinos encima del mapa

#### Scenario: Vista compacta
- **WHEN** la persona abre el explorador en un viewport compacto
- **THEN** no hay dock inferior con esas herramientas

#### Scenario: Toque en el terreno
- **WHEN** la persona toca una celda del mapa
- **THEN** no se abre un inspector flotante

### Requirement: Menú de capas desactivado
La persona SHALL NOT poder abrir un catálogo de capas ni cambiar la vista del mapa desde la HUD. El mapa SHALL permanecer en hundimiento acumulado.

#### Scenario: Buscar capas
- **WHEN** la persona busca el panel o el botón Capas
- **THEN** no existe ese control y el mapa sigue en hundimiento acumulado

### Requirement: Menú de contexto científico ausente
La persona SHALL NOT poder abrir el panel «Contexto científico» ni un botón Contexto en la HUD.

#### Scenario: Buscar contexto
- **WHEN** la persona busca el menú de contexto
- **THEN** no hay botón ni panel de contexto científico

### Requirement: Chrome permitido
La interfaz SHALL limitarse al lienzo del mapa, la línea de tiempo con la fecha, y el recuadro dedicado del modelo. Cualquier título o aviso de datos SHALL NOT ocupar un menú de herramientas.

#### Scenario: Pilotaje
- **WHEN** la persona vuela la nave
- **THEN** puede ver el terreno, avanzar o pausar la línea de tiempo, y no hay un menú de herramientas tapando el mapa
