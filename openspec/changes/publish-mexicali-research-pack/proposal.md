# Proposal

## Why

Los estudios del Valle de Mexicali dejan abiertos el hundimiento (geotermia, fallas y sismos mezclados), el acuífero sin modelo numérico y la salinidad que el Acta 242 no cerró, y los miden con GPS escaso, nivelación cada varios años y unos pocos instrumentos sobre fallas. El explorador ya tiene una malla densa y reciente de desplazamiento, uso de suelo y canales, pero solo como binarios de la web: un investigador no puede llevársela, ni ve qué preguntas publicadas esos archivos no responden.

## What Changes

- Paquete de investigación de la región `mexicali`, generado desde los cubos y vectores que el manifiesto ya publica (`subsidence`, `landcover`, `canals`, `roads`, `rivers`). Entrega GeoTIFF del desplazamiento en línea de vista y de su tasa, el uso de suelo, los vectores, y la tasa muestreada sobre canales y caminos. No es una evaluación de daños.
- Nota citada, en el mismo paquete y en una página aparte (`/investigacion`), con cuatro problemas que los papers no dan por resueltos y con los datos que este proyecto no tiene: pozos, sales, caudal, producción geotérmica y entregas de la CONAGUA.
- La página no es un panel del mapa. El lienzo sigue sin menús flotantes de capas, modelos, contexto, eventos, créditos, cultivos, destinos, inspector ni ajustes. Cultivos y hundimiento ×2000 no cambian.
- Si el extra `disturbance` no está en el manifiesto actual, el paquete no lo inventa: la nota dice que la coherencia falta en esta entrega y por qué los papers la necesitan.
- **Fuera de alcance:** nueva descarga NISAR, capa de salinidad, modelo de flujo, series de CONAGUA o SAGARPA, producción de Cerro Prieto, calidad del aire y cualquier otro tema de papers que no use estas mallas. Sin cambio de `schemaVersion` del manifiesto.

## Capabilities

### New Capabilities

- `mexicali-research-pack`: publicar la malla y los vectores ya medidos en un formato de escritorio, junto con la nota de problemas abiertos y de datos que el paquete no sustituye.

### Modified Capabilities

- Ninguna. `openspec list --specs` no tiene capacidades archivadas. Los changes en curso no cambian de requisito.

## Impact

- Pipeline: exportador nuevo junto a los cubos de `public/data/mexicali/`, sin reprocesar NISAR. `rasterio` ya está en el pipeline.
- Web: ruta estática `/investigacion` que lee el índice del paquete. El explorador 3D no gana paneles.
- Datos: una carpeta `research-pack/` por región. Los cubos `.bin` que ya consume la escena se quedan igual.
- Límites que la nota debe decir: la serie NISAR de esta escena es una ventana reciente, no la nivelación desde 1977 ni la red REDECVAM; la tasa no separa geotermia, tectónica y sismos; WorldCover no es el padrón de cultivos ni el volumen de riego.
