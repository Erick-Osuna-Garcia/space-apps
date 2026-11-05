# Spec Delta

## Purpose

Separa el movimiento medido en línea de vista en sus componentes vertical y este-oeste, para distinguir hundimiento real de deslizamiento lateral.

## ADDED Requirements

### Requirement: Hundimiento real en cada región
El pipeline SHALL generar la capa de desplazamiento LOS con datos NISAR para Mexicali y para Tijuana, usando el mejor stack ascendente y el mejor descendente de cada región.

#### Scenario: Tijuana con movimiento
- **WHEN** el usuario entra a Tijuana
- **THEN** tiene disponible la capa de desplazamiento y las vistas que dependen de ella

### Requirement: Componentes vertical y este-oeste
El pipeline SHALL combinar las velocidades de un stack ascendente y uno descendente, usando su geometría de observación, para estimar velocidad vertical y este-oeste en cm/año. Los píxeles sin dato en alguna geometría SHALL quedar sin dato.

#### Scenario: Componentes calculadas
- **WHEN** existen stacks ascendente y descendente sobre un píxel
- **THEN** ese píxel tiene velocidad vertical y este-oeste

#### Scenario: Una sola geometría
- **WHEN** un píxel solo tiene datos de una geometría
- **THEN** queda sin dato en ambas componentes

### Requirement: Vista de movimiento real
La UI SHALL ofrecer capas de movimiento vertical y este-oeste, y flechas sobre el terreno con dirección y magnitud del movimiento horizontal. La ayuda SHALL aclarar que el componente norte-sur no se puede medir bien con esta geometría.

#### Scenario: Flechas horizontales
- **WHEN** el usuario elige la capa este-oeste
- **THEN** ve flechas sobre el terreno, densidad adaptada al zoom, con su magnitud en la sonda
