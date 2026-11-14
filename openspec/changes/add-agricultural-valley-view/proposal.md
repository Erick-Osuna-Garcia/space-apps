# Proposal

## Why

El Valle de Mexicali ya está en el explorador 3D, con relieve, humedad NISAR, cobertura, canales y una línea de tiempo, pero esa información sigue partida por capas y leída punto a punto. Un agricultor, un gestor del agua o un estudiante no puede elegir una zona de cultivo y ver cómo cambiaron juntas la humedad, la superficie y el agua cercana. Este cambio convierte esos datos, que ya están medidos, en unidades agrícolas que se pueden consultar en el tiempo.

## What Changes

- Nuevas **zonas agrícolas de análisis** sobre la región `mexicali` que ya existe: parches contiguos de la clase Cultivos de ESA WorldCover 2021, consultables en el mapa. No son predios catastrales ni las zonas de hundimiento actuales.
- Nueva **lectura temporal por zona**: humedad del suelo (NISAR SME2), vegetación y cambios de superficie (GCOV) y disturbios, siguiendo las fechas que ya trae el manifiesto (oct-2025 a oct-2026). Se pueden comparar unas pocas zonas entre sí.
- Nuevo **contexto hídrico de la zona**: canales ya dibujados, cuerpos de agua de la capa de agua, y ríos de OpenStreetMap si el recorte actual no los trae. Indica cercanía; no modela riego ni caudal.
- Texto en lenguaje llano, en la misma línea que los indicadores actuales, que dice qué se mide y qué no: la humedad es de los primeros centímetros y a ~200 m; la cobertura es de 2021 y no distingue el cultivo; un cambio de radar no dice la causa ni recomienda regar.
- **Supuesto de extensión:** el área de estudio sigue siendo el Valle de Mexicali ya cargado (`bbox` de `mexicali`, celdas de ~121 m). La mención a «todo el estado de Baja California» se toma como la ubicación del valle, no como ampliar la escena. Cubrir el estado entero queda fuera: no hay assets NISAR ni grilla para eso.
- **No se retira** la nave, el relieve, la línea de tiempo ni las capas de movimiento de Cerro Prieto. La lectura agrícola se suma; el reto sigue siendo traducir SAR, no sustituirlo.
- **Fuera de alcance:** predicción de rendimiento, tipo de cultivo, cuentas de usuario, alertas, prescripción de riego, historia urbana de varias décadas y cualquier descarga nueva de NISAR.

## Capabilities

### New Capabilities
- `agricultural-zones`: identificar, listar y seleccionar las unidades de cultivo del valle sobre el mapa 3D.
- `agricultural-conditions`: mostrar y comparar, por fecha, la humedad y las señales de superficie de cada zona, en lenguaje comprensible.
- `zone-water-context`: relacionar una zona agrícola con los canales, ríos y cuerpos de agua cercanos que ya describen el territorio.

### Modified Capabilities
<!-- Ninguna: openspec/specs/ no tiene capacidades archivadas. Las capas, la línea de tiempo y la infraestructura actuales no cambian de requisito; esta lectura las consulta. -->

## Impact

- **Web:** lógica pura nueva en `src/features/explorer/lib/`, más UI en el explorador (lista de zonas, ficha, comparación y contorno en la escena). Reutiliza `landcover`, `moisture`, `surface` (HV y cambios), `disturbance`, `water` y los overlays de infraestructura.
- **Pipeline:** sin reprocesar NISAR. Solo si los ríos no están en `canals.json`, se amplía la consulta OSM y se regenera ese overlay, con el mismo formato de vías.
- **Datos:** se usan los cubos y el manifiesto ya generados. La humedad sigue en m³/m³; WorldCover sigue siendo una sola fecha (2021).
- **Límites que la UI debe decir:** un año de NISAR provisional, ruido y resolución distintos entre capas. La vista apoya la lectura del territorio; no evalúa daños, cosecha ni riesgo.
