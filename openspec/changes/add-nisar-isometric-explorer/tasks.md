# Tasks

## 1. Setup del pipeline Python

- [x] 1.1 Crear `pipeline/` con `pyproject.toml` (uv, Python 3.11+, deps: asf_search, h5py, numpy, rasterio, pyproj, pydantic, pyyaml; dev: pytest) y entry point `nisar-pipeline`; verificar que `uv run nisar-pipeline --help` funciona
- [x] 1.2 Agregar `pipeline/.cache/` y `.venv` al `.gitignore`; verificar con `git status` que no aparecen tras correr el pipeline
- [x] 1.3 Crear `pipeline/regions.yaml` con `mexicali` (bbox ~-115.65..-115.0, 32.2..32.75; capa `subsidence`; polígono de referencia estable; POIs Cerro Prieto y Mexicali) y `tijuana` (bbox ~-117.15..-116.8, 32.4..32.6; sin capas; POI Tijuana); implementar `config.py` con validación pydantic y tests de configuración válida e inválida

## 2. Contrato del manifiesto y modo sintético

- [x] 2.1 Implementar el modelo pydantic del manifiesto en `manifest.py` (schemaVersion, regiones, capas, `source`, créditos) y checar un fixture `pipeline/tests/fixtures/manifest.sample.json`; verificar con un test pytest que el fixture valida
- [x] 2.2 Implementar `dem.py`: recorte de Copernicus GLO-30 vía `/vsicurl/` y reproyección a EPSG:32611 en la grilla de la región; verificar con un test (bbox pequeño o mock) que las dimensiones y la georreferencia coinciden con la grilla
- [x] 2.3 Implementar `export.py` (terrain.bin Int16 LE, cube.bin Int16 mm con -32768 = nodata, manifest.json, chequeo de presupuesto de tamaño con reducción de resolución o error); verificar con tests de ida y vuelta binaria y del caso de exceso de presupuesto
- [x] 2.4 Implementar `synthetic.py` y la bandera `--synthetic` (cuenco gaussiano centrado en Cerro Prieto, `source: "synthetic"`); verificar que `uv run nisar-pipeline --synthetic` produce `public/data/manifest.json` válido y assets de ambas regiones dentro del presupuesto
- [x] 2.5 Documentar en `pipeline/README.md` la instalación, Earthdata (`~/.netrc`), el modo sintético y el formato de assets; verificar ejecutando los comandos documentados desde cero

## 3. Datos NISAR reales

- [x] 3.1 Implementar `discover.py` con `asf_search` (NISAR, GUNW, bbox, fechas) que escribe `pipeline/.cache/<region>/discovery.json` y falla con un error explícito si no hay productos; verificar con un test que mockea `asf_search` (con y sin resultados) y con una corrida real sobre Mexicali
- [x] 3.2 Revisar el reporte de descubrimiento real: si hay menos de 2 fechas útiles, activar el plan B (D6) y registrar la decisión en `pipeline/README.md`; verificar que la decisión y los ids de los productos quedan documentados
- [ ] 3.3 Implementar `download.py` con credenciales desde el entorno o `.netrc` (abortar si faltan, sin loguearlas) y caché que omite productos completos; verificar con tests de credenciales ausentes y de caché, y revisando los logs de una corrida real en busca de secretos
- [ ] 3.4 Implementar `gunw.py` para leer fase desenvuelta, coherencia, grilla y EPSG del HDF5 (rutas en una tabla de constantes según la especificación de producto) y remuestrear a la grilla de la región; verificar con un HDF5 sintético mínimo en los tests y con un producto real descargado
- [x] 3.5 Implementar `timeseries.py` (fase→cm LOS con λ=c/centerFrequency ≈ 0.2384 m, resta de la referencia estable, inversión SBAS por mínimos cuadrados, máscara de coherencia); verificar con tests sintéticos que recuperan una serie conocida, d(t0)=0 y la propagación de nodata
- [ ] 3.6 Integrar todo en `cli.py` (sin `--synthetic`) y generar los assets reales de Mexicali; verificar que Cerro Prieto aparece como alejamiento del satélite (hundimiento) del orden de cm/año, fijar la convención de signo en un test y versionar `public/data/`

## 4. Base del frontend

- [x] 4.1 Instalar `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` y `vitest` (con el script `test`); verificar que `bun run build` y `bun run test` pasan
- [ ] 4.2 Cargar los skills de TanStack Start y Router con Intent (`intent load @tanstack/react-start#...`) antes de tocar las rutas; convertir `src/routes/index.tsx` en la ruta del explorador con `ssr: false`, actualizar el título y los metadatos en `__root.tsx`, y agregar el fallback sin WebGL2; verificar en el navegador que la página carga y que, con WebGL desactivado, muestra el fallback
- [x] 4.3 Crear `src/features/explorer/manifest.ts` (Zod que espeja el modelo pydantic) y los queries de TanStack Query para el manifiesto y los binarios (decodificación a `Int16Array`); verificar con un test Vitest que el fixture compartido `pipeline/tests/fixtures/manifest.sample.json` valida y que una capa de tipo desconocido se omite con un aviso
- [x] 4.4 Crear `store.ts` con `@tanstack/store` (región, capas, opacidad, `dateIndex`, `playing`, sonda); verificar con tests unitarios de las transiciones (cambio de región, pausa al mover el slider)

## 5. Escena isométrica y nave

- [x] 5.1 Implementar `lib/` con muestreo bilineal del heightmap, rotación de ejes de entrada −45° y clamp al bbox; verificar con tests Vitest
- [ ] 5.2 Implementar `scene/Terrain` (PlaneGeometry desplazada por terrain.bin × exageración, normales, decimado en móvil) y la indicación de exageración en la UI; verificar en el navegador con los datos sintéticos que el relieve de Mexicali y la Sierra Cucapah se reconoce
- [ ] 5.3 Implementar `scene/IsoCamera` (ortográfica con azimut 45° y elevación 35.264°, seguimiento amortiguado, zoom limitado con rueda y pellizco); verificar en el navegador que el zoom respeta los límites y que el ángulo no cambia
- [ ] 5.4 Implementar `scene/Ship` low-poly y `controls/` de teclado (WASD/flechas, aceleración y fricción, altura sobre el terreno, borde de región); verificar en el navegador que la nave sigue el relieve y se detiene en el borde
- [ ] 5.5 Implementar clic/tap para volar (raycast + arrive steering, cancelable con teclado); verificar en el navegador y en emulación móvil (DevTools) que el tap mueve la nave
- [ ] 5.6 Implementar `ui/PoiList` y `scene/Warp` (vuelo dentro de la región, warp con carga de la otra región, aviso de "próximamente" en regiones sin capas, respeto a `prefers-reduced-motion`); verificar en el navegador el warp Mexicali→Tijuana→Cerro Prieto
- [ ] 5.7 Medir el rendimiento con `Stats` de drei, pilotando 30 s con la capa activa; verificar 50 FPS o más en la laptop de referencia y anotar el resultado en el PR

## 6. Capa de subsidencia y UI de datos

- [ ] 6.1 Extender el material del terreno con `onBeforeCompile` (DataArrayTexture de fechas, interpolación `uMix`, colormap divergente 1D, opacidad, color de nodata, fallback a DataTexture 2D sin WebGL2); verificar en el navegador que el cuenco sintético se colorea y que nodata se ve neutro
- [ ] 6.2 Implementar `ui/LayerPanel` (switch y opacidad) y `ui/Legend` (escala en cm, explicación del signo LOS, rango); verificar en el navegador que ocultar la capa restaura el sombreado base y oculta la leyenda
- [ ] 6.3 Implementar `ui/Timeline` (slider shadcn con fechas, play/pausa en bucle, fecha en texto, pausa al arrastrar, transición suave); verificar en el navegador y con el test del store
- [ ] 6.4 Implementar `ui/Probe` (publicación de la posición de la nave cada ~100 ms, valor en cm, coordenadas, mini-gráfica SVG, "sin dato (baja coherencia)"); verificar con un test Vitest de la lectura del cubo y sobrevolando Cerro Prieto en el navegador
- [ ] 6.5 Implementar `ui/DataNotice` (avisos para `synthetic` y `sentinel-1`) y `ui/Credits` (fuentes e ids de productos desde el manifiesto); verificar en el navegador que con los datos sintéticos se ve el aviso y que los créditos listan los productos
- [ ] 6.6 Implementar `ui/ContextPanel` en español (qué es SAR/InSAR, cómo leer la capa, hipótesis de extracción geotérmica en Cerro Prieto, aplicaciones futuras de NISAR) sin bloquear el pilotaje; verificar en el navegador que la nave se puede mover con el panel abierto

## 7. Integración y entrega

- [ ] 7.1 Verificar de extremo a extremo con los datos reales: `public/data/manifest.json` tiene la capa de Mexicali con `source: "nisar"` (o el plan B documentado y visible), cada ruta del manifiesto existe, y `bun run build && bun run preview` sirve la app completa
- [ ] 7.2 Correr `bun run check`, `bun run test` y `cd pipeline && uv run pytest`; verificar que todo pasa sin errores
- [ ] 7.3 Actualizar el `README.md` raíz (descripción del proyecto, cómo correr la app y el pipeline, fuentes y créditos de datos); verificar siguiendo el README desde un clon limpio

## 8. Análisis de la capa: velocidad, estadísticas y hundimiento 3D

- [ ] 8.1 Implementar `lib/stats.ts` (velocidad por píxel en cm/año, límite robusto p1–p99, estadísticas por fecha: máximo y su celda, área > umbral en km², velocidad media en el área); verificar con tests Vitest sobre cubos pequeños conocidos (incluido nodata y sin área sobre el umbral)
- [ ] 8.2 Agregar al store el modo de color (`cumulative` | `velocity`), el umbral de estadísticas, el hundimiento 3D (on/off) y su factor; verificar con tests del store
- [ ] 8.3 Extender el material: textura de velocidad + `uMode` en el fragment shader y desplazamiento vertical con normales perturbadas en el vertex shader (sin dato = sin desplazamiento); verificar en el navegador alternando los modos y activando ×5000 con la reproducción
- [ ] 8.4 Hacer que `heightAt` (vuelo, POIs, picking) siga la superficie desplazada; verificar en el navegador que la nave y los faros no quedan enterrados ni flotando al activar el modo 3D
- [ ] 8.5 UI: selector Acumulado/Velocidad en el panel de capas, leyenda y sonda en las unidades del modo, panel de estadísticas con umbral 2/5/10 cm y "volar al punto", control y etiqueta "Hundimiento exagerado ×N · ilustrativo"; verificar en el navegador cada escenario de la spec, también en vista compacta (móvil)

## 9. Indicadores amigables

- [ ] 9.1 Implementar `lib/friendly.ts` (nivel de tendencia, comparación de cm con objetos, área en canchas, punto de interés más cercano, tiempo transcurrido); verificar con tests Vitest de cada corte y caso borde
- [ ] 9.2 Implementar `ui/InfoHint` (ayuda con Popover) y agregarla a destinos, capas, hundimiento 3D, estadísticas, sonda y línea de tiempo; verificar en el navegador que abre con teclado, cierra con Escape y que la nave se puede pilotar con la ayuda abierta
- [ ] 9.3 Mostrar en la sonda el estado en palabras, la comparación y la ubicación; en estadísticas las comparaciones; en la línea de tiempo el tiempo transcurrido; verificar en el navegador en escritorio y en vista compacta sin scroll horizontal
