# Proposal

## Why

El explorador muestra cuánto se mueve el suelo, pero no qué significa para quien vive encima ni qué más cambia en la superficie. El reto pide usar polarizaciones, datos auxiliares y factores humanos para convertir el radar en información útil. Este change suma todos los datos de impacto viables y los hace explorables sobre el mapa, sin gráficas, en Mexicali y Tijuana.

## What Changes

- **Catálogo interactivo de capas:** selector por temas (Movimiento, Superficie, Agua, Impacto) y un inspector al tocar cualquier punto o elemento del mapa.
- **Movimiento:** hundimiento real también en Tijuana, separación vertical y este-oeste con flechas, y mapa de disturbios por coherencia.
- **Superficie (GCOV):** radar HH para construcciones, HV para vegetación, detección de cambios entre fechas y crecimiento urbano.
- **Agua (GCOV y SME2):** agua en superficie e inundaciones, y humedad del suelo.
- **Impacto:** pendiente y laderas activas, caminos y canales sobre zonas de hundimiento, población dentro de cada zona, y uso de suelo.
- **Manifiesto v2 BREAKING:** unidades, escalas de color y capas vectoriales nuevas. La web y el pipeline se actualizan juntos.
- **Fuera de alcance:**
  - **GOFF (desplazamientos grandes):** la búsqueda del 2026-11-04 dio 0 productos en Mexicali y 1 en Tijuana, así que no alcanza para una capa.
  - **Producción geotérmica:** no hay una fuente pública verificada; se agrega solo si se consigue una (ver design.md).
  - Gráficas de estadísticas, descartadas por el usuario, y tour guiado.

## Capabilities

### New Capabilities
- `interactive-layer-catalog`: selector de capas por temas, inspector al tocar el mapa y carga bajo demanda.
- `surface-condition-layers`: capas de estado de la superficie derivadas de GCOV, SME2 y coherencia.
- `motion-decomposition`: separación del movimiento en vertical y este-oeste con órbitas ascendente y descendente.
- `impact-exposure`: cruce del movimiento con pendiente, infraestructura, población y uso de suelo.

### Modified Capabilities
<!-- Ninguna: las specs de los changes anteriores aún no están archivadas en openspec/specs/. -->

## Impact

- **Depende de** `add-nisar-isometric-explorer` y `add-map-impact-views`, sin archivar. Reemplaza su selector de vistas por el catálogo.
- **Pipeline:** lectores de GCOV y SME2, descomposición y descarga de datos auxiliares (Copernicus, ESA WorldCover, OpenStreetMap, WorldPop). Requiere credenciales Earthdata.
- **Web:** `src/features/explorer/` (manifiesto, store, material, panel de capas y sonda).
- **Assets:** de ~16 MB a ~80 MB por región, cargados bajo demanda.
- **Tiempo:** GCOV pesa ~6.7 GB por producto; se leen recortes de fechas mensuales. Es la parte más lenta.
- **Licencias:** OpenStreetMap (ODbL), WorldPop (CC BY) y ESA WorldCover (CC BY) requieren atribución en los créditos.
