# Spec Delta

## Purpose

Resume en una lista qué cambió, dónde y cuándo, ubicando cada evento por zona para explorarlo sobre el mapa.

## ADDED Requirements

### Requirement: Detección de eventos
El pipeline SHALL detectar hundimiento por zona, cambios de ritmo, agua nueva, cambios bruscos en el terreno y cambios en la superficie, descartando áreas menores a su mínimo, y SHALL guardar cada evento con fecha, lugar, área y descripción.

#### Scenario: Zona de hundimiento
- **WHEN** un área conexa de más de 2 km² bajó más de 3 cm en el acumulado suavizado
- **THEN** se genera un evento con su máximo, área y velocidad mediana

#### Scenario: Cambio de ritmo
- **WHEN** la velocidad de una zona cambia 1.5 cm/año o más, con al menos 365 días de datos a cada lado
- **THEN** se genera un evento con la fecha aproximada y las dos velocidades

#### Scenario: Mismo lugar en varias fechas
- **WHEN** la misma área aparece en varias fechas
- **THEN** cuenta como un solo evento

### Requirement: Lista de eventos
Un botón de la HUD SHALL abrir la lista agrupada por tipo. Al tocar un evento, la nave SHALL volar a su lugar, y el mapa SHALL mostrar su capa y fecha con la reproducción pausada.

#### Scenario: Tocar un evento
- **WHEN** el usuario toca un evento de agua nueva
- **THEN** el mapa cambia a la capa de agua en esa fecha y la nave vuela al lugar

### Requirement: Sin atribuir causas
La lista SHALL aclarar que son cambios medidos y que no se conoce su causa ni confirman daños.

#### Scenario: Abrir la lista
- **WHEN** el usuario abre Eventos
- **THEN** ve esa aclaración antes de los eventos
