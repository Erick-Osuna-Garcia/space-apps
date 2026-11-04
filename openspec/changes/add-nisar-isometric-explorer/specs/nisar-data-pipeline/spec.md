# Spec Delta

## Purpose

Convierte productos de radar NISAR y datos de soporte (DEM) en assets web estáticos y reproducibles por región, para que la app pueda mostrar cambios de superficie sin procesar datos en el navegador.

## ADDED Requirements

### Requirement: Configuración declarativa de regiones
El pipeline SHALL leer las regiones a procesar desde un archivo de configuración versionado. Cada región define un id, un nombre, un bounding box WGS84, un rango de fechas y una lista de capas a generar. Una región sin capas de fenómeno SHALL producir igualmente sus assets de terreno.

#### Scenario: Región con capa de subsidencia
- **WHEN** la configuración define la región `mexicali` con la capa `subsidence`
- **THEN** el pipeline genera el terreno y la capa de subsidencia de esa región

#### Scenario: Región solo terreno
- **WHEN** la configuración define la región `tijuana` sin capas
- **THEN** el pipeline genera solo los assets de terreno y el manifiesto lista la región con cero capas

### Requirement: Descubrimiento de productos NISAR
El pipeline SHALL buscar en el archivo de ASF DAAC los productos NISAR del tipo requerido por cada capa (GUNW para subsidencia) que intersecten el bbox y el rango de fechas de la región, y SHALL escribir un reporte con los productos encontrados (id, fechas de referencia/secundaria, track, frame).

#### Scenario: Productos encontrados
- **WHEN** existen productos GUNW sobre el bbox de Mexicali en el rango de fechas
- **THEN** el reporte lista cada producto con sus fechas y el pipeline continúa a la descarga

#### Scenario: Sin cobertura
- **WHEN** la búsqueda no devuelve productos para una capa
- **THEN** el pipeline termina esa capa con un error explícito que nombra la región, la capa y los criterios de búsqueda, y no genera assets parciales de esa capa

### Requirement: Credenciales fuera de los artefactos
El pipeline SHALL obtener las credenciales de NASA Earthdata del entorno o de `~/.netrc`, y MUST NOT escribirlas en logs, reportes ni assets generados.

#### Scenario: Credenciales ausentes
- **WHEN** se intenta descargar sin credenciales configuradas
- **THEN** el pipeline aborta antes de descargar, con un mensaje que indica cómo configurar Earthdata

### Requirement: Descargas reproducibles con caché
El pipeline SHALL guardar los productos descargados en un directorio de caché fuera del control de versiones y SHALL omitir la descarga de un producto que ya está completo en la caché.

#### Scenario: Re-ejecución
- **WHEN** el pipeline se ejecuta por segunda vez con la misma configuración
- **THEN** no vuelve a descargar productos ya presentes y produce assets idénticos

### Requirement: Serie de tiempo de desplazamiento LOS
Para la capa de subsidencia, el pipeline SHALL convertir la fase desenvuelta a desplazamiento en línea de vista en centímetros y SHALL construir una serie de tiempo acumulada relativa a la primera fecha. Los píxeles con coherencia por debajo de un umbral configurable SHALL marcarse como sin dato.

#### Scenario: Serie generada
- **WHEN** hay al menos dos fechas de adquisición conectadas por interferogramas
- **THEN** se genera un raster de desplazamiento acumulado por fecha, con la primera fecha igual a 0 cm en todos los píxeles válidos

#### Scenario: Baja coherencia
- **WHEN** un píxel tiene coherencia menor al umbral
- **THEN** ese píxel queda marcado como sin dato en todos los rasters de la serie

### Requirement: Terreno a partir de DEM
El pipeline SHALL generar para cada región un heightmap del DEM Copernicus GLO-30 recortado al bbox, alineado a la misma grilla que las capas de esa región, con una resolución máxima configurable.

#### Scenario: Grillas alineadas
- **WHEN** se generan el terreno y la capa de subsidencia de una región
- **THEN** ambos rasters tienen las mismas dimensiones y la misma georreferencia

### Requirement: Manifiesto de assets
El pipeline SHALL escribir un manifiesto JSON en el directorio público de datos. Para cada región lista su bbox, sus dimensiones de grilla, el rango de alturas, las rutas de los assets, y por capa: tipo, unidades, rango de valores, fechas, ids de productos fuente y créditos. El manifiesto SHALL incluir una versión de esquema.

#### Scenario: Manifiesto válido
- **WHEN** el pipeline termina sin errores
- **THEN** el manifiesto existe, valida contra su esquema y cada ruta que lista apunta a un archivo existente

### Requirement: Presupuesto de tamaño
El total de assets generados por región SHALL caber en un presupuesto configurable (por defecto 15 MB). Si se excede, el pipeline SHALL reducir la resolución o fallar con un mensaje que indique el tamaño obtenido.

#### Scenario: Exceso de tamaño
- **WHEN** los assets de una región superan el presupuesto
- **THEN** el pipeline reduce la resolución hasta cumplirlo, o reporta el exceso y termina con error
