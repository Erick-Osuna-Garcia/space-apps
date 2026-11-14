# Spec Delta

## Purpose

Muestra, para cada zona agrícola y a lo largo de las fechas NISAR, la humedad del suelo y las señales de superficie en un lenguaje que no exige saber de radar.

## ADDED Requirements

### Requirement: Humedad media de la zona
Con una zona elegida, el sistema SHALL mostrar la humedad media de sus celdas con dato en la fecha activa, en m³/m³, y SHALL indicar que describe los primeros centímetros del suelo a unos 200 m.

#### Scenario: Ver la humedad de la fecha
- **WHEN** la zona tiene celdas con humedad en la fecha de la línea de tiempo
- **THEN** la ficha muestra esa media en m³/m³ y la aclaración de profundidad y resolución

#### Scenario: Fecha sin humedad válida
- **WHEN** ninguna celda de la zona tiene humedad en esa fecha
- **THEN** la ficha dice que no hay lectura y no presenta cero como si el suelo estuviera seco

### Requirement: Serie de humedad
El sistema SHALL mostrar la humedad media de la zona en cada fecha disponible y SHALL resaltar la fecha activa de la línea de tiempo.

#### Scenario: Mover la línea de tiempo
- **WHEN** el usuario cambia la fecha
- **THEN** la media y el resalte de la serie corresponden a esa fecha

### Requirement: Señales de superficie sin atribuir causa
Si existen las capas de vegetación, de cambios o de disturbios, el sistema SHALL resumir en la fecha activa si la señal de radar subió, bajó o si la superficie se disturbó. Ese resumen SHALL NOT nombrar un cultivo, una causa ni una recomendación de riego.

#### Scenario: Cambio de señal
- **WHEN** la zona tiene un cambio de superficie o un disturbio en la fecha activa
- **THEN** la ficha lo describe como cambio medido y aclara que no indica su causa

#### Scenario: Capa ausente
- **WHEN** una de esas capas no está cargada
- **THEN** la ficha omite ese dato y sigue mostrando los que sí existen

### Requirement: Comparar unas pocas zonas
El sistema SHALL comparar la serie de humedad de hasta tres zonas con las mismas fechas y SHALL impedir una cuarta comparación, indicando el límite.

#### Scenario: Tres zonas
- **WHEN** el usuario agrega una segunda y una tercera zona a la comparación
- **THEN** las tres series se ven juntas, alineadas por fecha

#### Scenario: Una zona de más
- **WHEN** el usuario intenta agregar una cuarta zona
- **THEN** la comparación no la agrega y se indica que el límite es tres

### Requirement: Límites de la lectura
La ficha de la zona SHALL decir que la clase Cultivos es el mapa de 2021, que no identifica el cultivo de cada fecha NISAR, y que la vista no estima cosecha ni aconseja riego.

#### Scenario: Abrir la ficha
- **WHEN** hay una zona seleccionada
- **THEN** la ficha incluye esas tres aclaraciones junto con los números
