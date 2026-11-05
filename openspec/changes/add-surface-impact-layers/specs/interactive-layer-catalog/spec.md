# Spec Delta

## Purpose

Permite descubrir y explorar todas las capas de impacto de una región desde un solo catálogo, y consultar cualquier punto o elemento tocándolo en el mapa.

## ADDED Requirements

### Requirement: Catálogo por temas
La UI SHALL agrupar las capas de la región en los temas Movimiento, Superficie, Agua e Impacto, mostrando solo las disponibles. Elegir una capa SHALL pintarla en el mapa, con una sola capa principal activa a la vez.

#### Scenario: Elegir una capa
- **WHEN** el usuario abre el tema Agua y elige "Humedad del suelo"
- **THEN** el mapa pinta esa capa y la leyenda y la ayuda pasan a explicarla

#### Scenario: Región sin una capa
- **WHEN** una capa no existe en la región activa
- **THEN** no aparece en el catálogo

### Requirement: Superposición de infraestructura
Sobre la capa principal, el usuario SHALL poder encender o apagar las superposiciones vectoriales de caminos y canales.

#### Scenario: Encender caminos
- **WHEN** el usuario activa "Caminos" con una capa principal activa
- **THEN** los caminos se dibujan encima sin cambiar la capa principal

### Requirement: Inspector del mapa
Al tocar un punto, el usuario SHALL ver qué dice cada capa disponible de ese lugar, en lenguaje claro. El toque SHALL seguir volando la nave a ese punto.

#### Scenario: Tocar el terreno
- **WHEN** el usuario toca un punto del Valle de Mexicali
- **THEN** el inspector muestra el hundimiento, el uso de suelo, la humedad y la pendiente de ese punto, y la nave vuela hacia ahí

#### Scenario: Capa sin dato en el punto
- **WHEN** una capa no tiene dato en el punto tocado
- **THEN** el inspector la muestra como "Sin dato" en vez de ocultarla

### Requirement: Carga bajo demanda
Cada capa SHALL descargarse solo cuando se elige, mostrando su estado de carga, y SHALL permanecer en memoria mientras dure la sesión. Si la descarga falla, la UI SHALL indicarlo sin afectar a la escena.

#### Scenario: Primera vez que se elige una capa
- **WHEN** el usuario elige una capa aún no descargada
- **THEN** el catálogo indica que está cargando y el mapa la pinta al terminar

#### Scenario: Error de descarga
- **WHEN** la descarga de una capa falla
- **THEN** el catálogo muestra el error y el mapa conserva la capa anterior

### Requirement: Línea de tiempo por capa
La línea de tiempo SHALL usar las fechas de la capa activa. Al cambiar de capa SHALL ir a la fecha más cercana a la actual, y las capas sin fechas SHALL ocultarla e indicar que son estáticas.

#### Scenario: Capa con otras fechas
- **WHEN** el usuario pasa de una capa quincenal a una mensual
- **THEN** la línea de tiempo muestra las fechas mensuales y queda en la más cercana

#### Scenario: Capa estática
- **WHEN** el usuario elige "Uso de suelo"
- **THEN** la línea de tiempo se oculta y el título indica la fecha de referencia de esa capa

### Requirement: Origen de cada capa
Cada capa SHALL mostrar su fuente y sus créditos. Una capa que no venga de NISAR SHALL identificar su fuente real en el catálogo y en el inspector.

#### Scenario: Capa de población
- **WHEN** el usuario elige la capa de población
- **THEN** el catálogo y los créditos identifican a WorldPop como fuente
