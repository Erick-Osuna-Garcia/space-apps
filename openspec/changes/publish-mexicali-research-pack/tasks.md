# Tasks

## 1. Paquete desde el manifiesto

- [ ] 1.1 Agregar `write_research_pack` que lea el manifiesto y los cubos de `subsidence` y `landcover` y escriba `research-pack/displacement.tif` (float32, `scale` ya aplicado, una banda por fecha, nodata NaN, affine desde `bboxProjected` y `cellSizeM`) y `landcover.tif` (clases enteras). Verificar con pytest, en una grilla chica, el valor físico, el CRS `EPSG:32611`, el tamaño de grilla y que una capa ausente queda `absent: true` en `index.json` sin archivo inventado
- [ ] 1.2 Escribir `rate.tif` con la misma tendencia que `velocityField` (años desde la primera fecha, mínimo dos muestras válidas) en cm/año, y omitir el archivo si hay menos de dos fechas. Verificar con pytest un caso de dos fechas contra el cálculo a mano y un caso de una fecha sin `rate.tif` y con la nota en el índice
- [ ] 1.3 Pasar canales, caminos y ríos de columna/fila a GeoJSON WGS84 con el inverso de `Grid.lonlat_to_colrow`. En canales y caminos, poner `losRateCmPerYear` de la celda de tasa más cercana al vértice medio, o null si es nodata. Los ríos no llevan tasa. Verificar con pytest la longitud/latitud de un punto conocido, el null, y que `index.json` dice que la muestra no es daño
- [ ] 1.4 Escribir `nota.md` con los siete DOI del spec, los límites (sin causa, sin modelo de flujo, sin sales, sin daño, sin pozos, sin caudal, sin producción geotérmica, sin entregas) y, si no hay capa `disturbance`, la frase de coherencia ausente por decorrelación agrícola, sin raster de coherencia. Si `source` es `synthetic`, la nota y el índice dicen que no es medición NISAR. Verificar con pytest que esos DOI y esas frases están y que no aparece un archivo de coherencia
- [ ] 1.5 Llamar al writer al final de `run`, después de `write_manifest`, sin sumar los GeoTIFF a `check_budget`, y sin reloj propio. Verificar con `uv run pytest tests/test_synthetic_build.py tests/test_research_pack.py` en `pipeline/` que la segunda ejecución sigue siendo byte a byte idéntica y que el directorio sintético contiene `research-pack/index.json`

## 2. Entrega con el manifiesto actual

- [ ] 2.1 Correr el writer sobre `public/data/manifest.json` sin descargar NISAR. Verificar que `public/data/mexicali/research-pack/` contiene `displacement.tif`, `rate.tif`, `landcover.tif`, los tres GeoJSON, `index.json` y `nota.md`, que el índice marca `displacementSource` synthetic y que `nota.md` incluye los siete DOI

## 3. Página fuera del mapa

- [ ] 3.1 Extraer el armado de la vista (lista de archivos o estado vacío, más el texto de la nota) a una función pura y cubrirla con Vitest: índice presente lista unidades y créditos; índice ausente no muestra cifras
- [ ] 3.2 Agregar la ruta `/investigacion` que usa esa función y lee `/data/mexicali/research-pack/index.json` y `nota.md`. Verificar con Vitest el estado vacío y que `Explorer.tsx` no importa la ruta ni agrega un control del paquete
