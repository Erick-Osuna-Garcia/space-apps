# Proposal

## Why

El reto "Dancing with the SARs" (NASA Space Apps 2026) pide una app interactiva y open-source que traduzca datos de radar NISAR en cambios de la superficie que la gente pueda entender. Mexicali tiene una de las señales InSAR más fuertes del mundo: el hundimiento del terreno alrededor del campo geotérmico de Cerro Prieto, de varios centímetros por año. Pero esa señal está escondida en archivos HDF5 de fase interferométrica. Queremos convertirla en una experiencia que se pueda explorar: pilotar una nave sobre un mapa 3D isométrico de Baja California y ver cómo se hunde el suelo con el tiempo.

## What Changes

- Nuevo **pipeline de datos offline en Python** (`pipeline/`). Busca y descarga productos NISAR L2 GUNW de ASF DAAC sobre Mexicali/Cerro Prieto. Convierte la fase desenvuelta en desplazamiento en línea de vista (LOS) en cm, arma una serie de tiempo acumulada y exporta assets estáticos para la web: heightmap del DEM, rasters de desplazamiento por fecha, máscara de coherencia y un manifiesto JSON con metadatos y créditos de datos.
- Nueva **escena 3D isométrica** en la app TanStack Start (React Three Fiber). Muestra terreno real estilizado a partir del DEM Copernicus GLO-30, con cámara ortográfica isométrica y regiones navegables. **Mexicali** es la región con datos; **Tijuana** solo tiene terreno, y sus capas de fenómenos quedan pendientes.
- Nueva **nave pilotable**: se controla con teclado (WASD/flechas) y con clic/tap para volar a un punto. La cámara la sigue. Incluye puntos de interés con "warp" (planta Cerro Prieto, ciudad de Mexicali, Tijuana).
- Nueva **capa de cambio de superficie con línea de tiempo**: colorea el terreno con el desplazamiento acumulado, tiene un slider de fechas con reproducción animada, y una sonda bajo la nave que muestra el valor de desplazamiento y la serie de tiempo del punto sobrevolado.
- Panel de **contexto narrativo**: explica qué es SAR/InSAR, por qué se hunde Cerro Prieto (extracción de fluidos geotérmicos) y qué significan los colores, junto con los créditos de datos (NASA/ISRO/ASF/Copernicus).
- **Análisis de la capa** (agregado el 2026-11-04 a pedido del usuario):
  - Modo **velocidad** (cm/año) además del acumulado.
  - Panel de **estadísticas**: hundimiento máximo con vuelo al punto, área que supera un umbral y velocidad media de la zona que se hunde.
  - Modo opcional de **hundimiento 3D exagerado**, en el que el terreno baja visualmente según el dato y lleva una etiqueta clara de que es ilustrativo.
- **Indicadores amigables** (agregado a pedido del usuario): estado del punto en palabras, comparaciones cotidianas (objetos y canchas de fútbol), distancia al punto de interés más cercano, tiempo transcurrido y ayuda "?" en cada panel, para que los datos se entiendan sin saber de radar.
- Se reemplaza la página de inicio del template por el explorador.
- **Fuera de alcance (registrado para cambios futuros):**
  - Ciclos agrícolas del Valle de Mexicali (GCOV HH/HV).
  - Expansión urbana de Tijuana (GCOV multi-fecha).
  - Inundaciones del Río Tijuana (GCOV).
  - **Tour guiado / modo misión**: ruta automática con paradas narradas.

  El modelo de capas debe dejar sitio para agregarlos sin rediseñar.

## Capabilities

### New Capabilities
- `nisar-data-pipeline`: descubrimiento, descarga y procesamiento offline de productos NISAR (y DEM de soporte) hacia assets web estáticos con un manifiesto versionado.
- `isometric-explorer`: escena 3D isométrica de terreno por regiones, la nave pilotable, la cámara de seguimiento, la navegación entre puntos de interés y los controles de teclado y puntero.
- `surface-change-layers`: capas de cambio de superficie montadas sobre el terreno (hoy, la subsidencia InSAR), con la línea de tiempo, la leyenda, la sonda de valores y el contexto narrativo.

### Modified Capabilities
<!-- Ninguna: no existen specs previas en openspec/specs/. -->

## Impact

- **Código nuevo:** `pipeline/` (Python 3.11+, con `asf_search`, `h5py`, `rasterio`, `numpy` y `xarray`), `public/data/` con los assets generados, y `src/features/explorer/` con la escena, la nave, la UI y el store.
- **Rutas:** `src/routes/index.tsx` pasa a ser el explorador, renderizado solo en el cliente porque WebGL no corre en SSR.
- **Dependencias web nuevas:** `three`, `@react-three/fiber`, `@react-three/drei`.
- **Cuentas externas:** se necesita una cuenta NASA Earthdata (gratuita) para descargar de ASF. Sus credenciales se usan solo en el pipeline, nunca en la app.
- **Riesgo de datos:** la cobertura NISAR sobre Mexicali y la cantidad de pares GUNW publicados pueden ser limitadas. El pipeline debe reportar lo que encontró, y el diseño define un plan B documentado.
- **Tamaño del bundle:** los assets raster se limitan por región (ver design.md) para que la carga sea rápida.
