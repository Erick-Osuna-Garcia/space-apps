# Spec Delta

## Purpose

Extiende la serie de desplazamiento de Mexicali años antes de NISAR con Sentinel-1, sin ocultar de qué satélite viene cada fecha. Es opcional: los datos publicados no la activan.

## ADDED Requirements

### Requirement: Serie combinada
El pipeline SHALL encadenar los productos OPERA DISP-S1 del frame configurado y empalmar por píxel la serie NISAR a partir del valor acumulado en su fecha inicial, en una sola capa de desplazamiento.

#### Scenario: Serie larga
- **WHEN** la capa tiene historia configurada
- **THEN** su primera fecha es de 2016 y la última es la última fecha NISAR

#### Scenario: Grupos de referencia
- **WHEN** los productos cambian de fecha de referencia
- **THEN** cada grupo continúa desde el valor acumulado del grupo anterior

### Requirement: Procedencia por fecha
El manifiesto SHALL declarar los tramos de fechas de cada fuente, y la UI SHALL mostrar qué satélite corresponde a la fecha seleccionada.

#### Scenario: Fecha anterior a NISAR
- **WHEN** la fecha seleccionada es de 2020
- **THEN** la UI indica Sentinel-1 en el subtítulo y en el aviso de datos

#### Scenario: Fecha NISAR
- **WHEN** la fecha seleccionada es de 2026
- **THEN** la UI indica NISAR y no muestra el aviso

### Requirement: Comparación entre satélites
El pipeline SHALL calcular y registrar la correlación y la diferencia de velocidad entre Sentinel-1 y NISAR en el periodo común.

#### Scenario: Periodo común
- **WHEN** ambas series cubren las mismas fechas
- **THEN** el log registra la correlación y la diferencia mediana en cm/año
