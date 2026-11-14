# Spec Delta

## Purpose

Agrupa el suelo de cultivo del Valle de Mexicali en unidades que se pueden listar, ver y elegir en el mapa, aparte de las zonas de hundimiento.

## ADDED Requirements

### Requirement: Unidades de cultivo en el valle
En la región de Mexicali, el sistema SHALL formar zonas agrícolas con las celdas contiguas clasificadas como Cultivos y SHALL descartar los parches bajo el área mínima que indique la ayuda. Cada zona SHALL mostrar su área.

#### Scenario: Parche de cultivo suficiente
- **WHEN** hay un parche contiguo de Cultivos que supera el área mínima
- **THEN** aparece en la lista con su área en kilómetros cuadrados

#### Scenario: Parche demasiado pequeño
- **WHEN** un parche de Cultivos queda bajo el área mínima
- **THEN** no entra en la lista de zonas

#### Scenario: Sin mapa de cobertura
- **WHEN** la región no tiene la capa de cobertura
- **THEN** la lista queda vacía y se indica que falta el mapa de cobertura

### Requirement: La lista muestra las zonas mayores
Si hay más parches válidos que el cupo que indica la ayuda, el sistema SHALL listar solo los de mayor área y SHALL decir que los demás no se muestran.

#### Scenario: Más parches que el cupo
- **WHEN** los parches válidos superan el cupo de la lista
- **THEN** se listan los de mayor área y la ayuda aclara que hay parches omitidos

### Requirement: Elegir una zona en el mapa
El sistema SHALL permitir elegir una zona desde la lista o tocando una celda que le pertenezca, SHALL dibujar su contorno y SHALL poder llevar la nave hasta ella.

#### Scenario: Elegir desde la lista
- **WHEN** el usuario elige una zona de la lista
- **THEN** el mapa marca su contorno y la nave puede volar a esa zona

#### Scenario: Tocar una celda de la zona
- **WHEN** el usuario toca una celda que pertenece a una zona listada
- **THEN** esa zona queda seleccionada

#### Scenario: Tocar suelo que no es cultivo
- **WHEN** el usuario toca una celda que no es Cultivos y no pertenece a una zona
- **THEN** ese toque no selecciona una zona agrícola

### Requirement: No mezclar con el hundimiento
Las zonas agrícolas SHALL ser una lista distinta de las zonas de hundimiento. Elegir una SHALL NOT cambiar la otra lista ni su nombre.

#### Scenario: Las dos listas conviven
- **WHEN** hay zonas agrícolas y zonas de hundimiento
- **THEN** cada una conserva su lista, y elegir una zona agrícola no reemplaza las de hundimiento

### Requirement: Solo el valle cargado
El sistema SHALL ofrecer estas zonas en la región de Mexicali ya cargada y SHALL NOT ofrecerlas para cubrir el resto de Baja California.

#### Scenario: Fuera de Mexicali
- **WHEN** la región activa no es Mexicali
- **THEN** no se ofrecen zonas agrícolas
