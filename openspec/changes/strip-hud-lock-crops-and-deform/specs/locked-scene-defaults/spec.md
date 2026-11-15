# Spec Delta

## Purpose

Fija la escena del valle: las plantas de cultivo se ven siempre y el hundimiento 3D se dibuja siempre con exageración ×2000, sin que la persona pueda apagarlos o subir el factor.

## ADDED Requirements

### Requirement: Cultivos siempre visibles en Mexicali
En la región Mexicali, cuando hay cobertura de suelo, el mapa SHALL mostrar los modelos de cultivo sobre la clase Cultivos. SHALL NOT exigir un panel, un botón ni un modo «Cultivos» para que aparezcan.

#### Scenario: Entrar al valle
- **WHEN** la persona abre el explorador en Mexicali con cobertura de suelo cargada
- **THEN** hay modelos de cultivo en las parcelas de clase Cultivos

#### Scenario: Sin interruptor
- **WHEN** la persona busca un control para ocultar los cultivos
- **THEN** no hay botón, switch ni ajuste que los apague

#### Scenario: Tijuana
- **WHEN** la persona está en Tijuana
- **THEN** no se colocan modelos de cultivo

### Requirement: Hundimiento 3D fijo en ×2000
El relieve deformado por el cubo de desplazamiento SHALL estar siempre activo con factor ×2000. SHALL NOT ofrecer otros factores ni un interruptor para aplanar el hundimiento.

#### Scenario: Carga inicial
- **WHEN** el explorador muestra el valle con cubo de desplazamiento
- **THEN** el terreno se deforma con factor ×2000

#### Scenario: Ajustes de relieve
- **WHEN** la persona abre cualquier diálogo de ajustes que aún exista
- **THEN** no hay control de «Hundimiento 3D» ni selector ×2000 / ×5000 / ×10000
