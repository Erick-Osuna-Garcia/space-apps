# Spec Delta

## Purpose

Muestra cómo cambia el estado de la superficie (construcción, vegetación, agua, humedad y disturbios) a partir de NISAR, para ver impactos que el movimiento del suelo no revela.

## ADDED Requirements

### Requirement: Capas de retrodispersión
El pipeline SHALL generar por región series mensuales de retrodispersión HH y HV en decibeles desde NISAR GCOV, y la UI SHALL mostrarlas como capas "Construcciones y suelo" y "Vegetación". Las fechas SHALL venir de un mismo stack para que sean comparables.

#### Scenario: Ciclo de cultivo
- **WHEN** el usuario reproduce la capa Vegetación en el Valle de Mexicali
- **THEN** los campos cambian de intensidad entre fechas

#### Scenario: Sin productos
- **WHEN** no hay productos GCOV para una región
- **THEN** el pipeline falla esa capa con un error explícito y las demás capas se generan

### Requirement: Detección de cambios
La UI SHALL ofrecer una capa que marque dónde la retrodispersión subió o bajó de forma significativa desde la primera fecha, con un umbral que evite marcar ruido.

#### Scenario: Crecimiento urbano
- **WHEN** en Tijuana aparece una construcción nueva dentro del periodo
- **THEN** esa área se marca como aumento de señal, y la ayuda aclara que el cambio indica algo distinto en la superficie, no su causa

### Requirement: Agua en superficie
La UI SHALL mostrar por fecha las áreas clasificadas como agua a partir de la señal baja de GCOV, excluyendo sombras de radar en laderas y distinguiendo agua permanente de agua nueva.

#### Scenario: Agua nueva
- **WHEN** una fecha muestra agua donde normalmente no hay
- **THEN** esa área se pinta como agua nueva

#### Scenario: Ladera en sombra
- **WHEN** una ladera empinada tiene señal baja
- **THEN** no se clasifica como agua

### Requirement: Humedad del suelo
La UI SHALL mostrar por fecha la humedad del suelo de NISAR SME2 con una escala de seco a húmedo, en sus unidades originales, indicando que su resolución es de ~200 m.

#### Scenario: Ver humedad
- **WHEN** el usuario elige la capa de humedad
- **THEN** el mapa pinta la humedad de la fecha y la sonda muestra su valor

### Requirement: Mapa de disturbios
La UI SHALL mostrar por fecha dónde la coherencia de un interferograma cae claramente respecto a la coherencia típica de ese píxel, como indicador de que la superficie cambió entre dos pasadas.

#### Scenario: Caída de coherencia
- **WHEN** un área pierde coherencia en un par de fechas
- **THEN** se marca como disturbio, y la ayuda indica causas posibles sin afirmar una
