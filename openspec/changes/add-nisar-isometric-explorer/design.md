# Design

## Context

- El repo es un template recién creado de **TanStack Start**: React 19, Vite 8, Tailwind 4, shadcn/ui, TanStack Query/Store/DB, Biome y Bun. Solo tiene `src/routes/__root.tsx` y una `index.tsx` de bienvenida, y no hay runner de tests.
- No hay código de datos ni de 3D. Todo es greenfield.
- Las decisiones del usuario son: (1) MVP = subsidencia de Cerro Prieto, con los demás fenómenos para después; (2) terreno real estilizado desde DEM; (3) pipeline offline en Python.
- Mexicali (~-115.5°) y Tijuana (~-117.0°) caen en la zona UTM 11N (EPSG:32611), así que una sola proyección métrica sirve para ambas regiones.
- Motivación y alcance: ver `proposal.md`. Comportamiento exigido: ver `specs/`.

## Goals / Non-Goals

**Goals:**
- Una ruta reproducible y documentada de ASF → assets → escena, que cualquier jurado pueda re-ejecutar.
- Que el frontend se pueda desarrollar en paralelo al pipeline usando un manifiesto sintético con el mismo esquema.
- Assets pequeños y servidos como estáticos: la app no necesita backend ni credenciales en runtime.

**Non-Goals:**
- Procesar SAR en el navegador o en un servidor en vivo.
- Hacer un InSAR de nivel científico (corrección troposférica avanzada, separación vertical/este-oeste con varias geometrías). Se reporta desplazamiento **LOS** y se dice claramente.
- Globo terráqueo o mapas base de teselas (Cesium/Mapbox). La escena es un diorama local por región.
- Capas GCOV (agricultura, urbano, inundaciones), multijugador y cuentas de usuario.

## Decisions

### D1. Fuente de datos principal: NISAR L2 GUNW vía ASF DAAC
- **Qué:** productos *Geocoded Unwrapped Interferogram* (GUNW, HDF5). Traen la fase desenvuelta y la coherencia ya geocodificadas, así que no hace falta desenvolver la fase nosotros. Para buscar y descargar se usa `asf_search` (buscando por plataforma NISAR, tipo de producto GUNW, `intersectsWith` = WKT del bbox y el rango de fechas), con autenticación por Earthdata (`~/.netrc` o variables de entorno).
- **Interfaz manual equivalente:** Vertex (search.asf.alaska.edu) y Earthdata Search. Sirven para explorar la cobertura antes de correr el pipeline.
- **Por qué no RSLC/RIFG:** habría que hacer el interferograma y el desenvolvimiento nosotros (ISCE3), y eso no cabe en un hackathon.
- **Por qué no GCOV ahora:** GCOV mide backscatter y sirve para agricultura, zonas urbanas e inundaciones, que son los fenómenos que quedan para después. La subsidencia necesita fase.
- La ruta exacta de los datasets dentro del HDF5 (frecuencia A/L-band, polarización HH, `unwrappedPhase`, `coherenceMagnitude`, grilla x/y y EPSG) se toma de la especificación de producto NISAR GUNW. El pipeline la deja en una tabla de constantes para que sea fácil de ajustar.
- **Ajuste durante la implementación (2026-11-04):**
  - El descubrimiento real encontró 27 pares PROVISIONAL (CRID P05023) en el track 5/frame 18, que suman unos 62 GB, porque cada GUNW pesa ~2 GB. Por eso **no se descargan los HDF5 completos**: se abren por HTTPS con `earthaccess` (fsspec, lectura por rangos), h5py lee solo la ventana del bbox, y el **recorte** se guarda en `.cache/` con escritura atómica (`.npz`). La "descarga con caché" de la spec aplica a esos recortes.
  - Según JPL D-102272, el GUNW tiene la fase a **80 m**, solo incluye **pares consecutivos de 12 días** e incluye una `ionospherePhaseScreen` **que no viene aplicada**. El pipeline la resta por defecto (`ionosphere_correction`).
  - λ se calcula de `centerFrequency`.

### D2. Fase → desplazamiento y serie de tiempo (SBAS simplificado)
- `d_LOS = -(λ / 4π) · φ`, con λ ≈ 0.2384 m (NISAR L-band), resultado en cm. **El signo se valida empíricamente:** Cerro Prieto debe salir como alejamiento del satélite (hundimiento). Si sale al revés, se invierte la constante y se documenta.
- **Referencia espacial:** un polígono estable configurable (p. ej. roca de la Sierra Cucapah). A cada interferograma se le resta la mediana de esa zona, lo que quita el offset arbitrario de la fase.
- **Inversión:** se resuelve por mínimos cuadrados, píxel a píxel, sobre la red de pares (fecha_i, fecha_j) para obtener el desplazamiento acumulado por fecha, con d(t0) = 0. Si la red solo tiene pares consecutivos, esto se reduce a una suma acumulada. Basta con numpy; no hace falta MintPy.
- **Máscara:** coherencia promedio < umbral (por defecto 0.3) → sin dato.
- **Alternativa considerada:** MintPy. Es más robusta, pero pesada de instalar y configurar para datos NISAR recién liberados. Queda como mejora futura.

### D3. Terreno: Copernicus DEM GLO-30 desde AWS Open Data
- Se lee con rasterio desde `s3://copernicus-dem-30m/` vía `/vsicurl/`, que es público y no requiere credenciales. Se reproyecta a EPSG:32611 y se remuestrea a la **grilla de la región**, la misma que la capa de desplazamiento (spec: grillas alineadas).
- **Alternativa:** NASADEM o SRTM (Earthdata). Copernicus tiene mejor calidad y no pide login.

### D4. Formato de assets: binarios planos + manifiesto JSON
- `public/data/<region>/terrain.bin`: Int16 LE, alturas en metros, de tamaño W×H.
- `public/data/<region>/<layer>/cube.bin`: Int16 LE, desplazamiento en **mm**, de tamaño T×H×W. `-32768` = sin dato.
- `public/data/manifest.json`: `schemaVersion`, regiones (bbox WGS84 y UTM, `width`, `height`, `cellSizeM`, `heightRange`, `pois[]`) y capas (`type: "los-displacement"`, `units: "cm"`, `dates[]`, `valueRange`, `colormap`, `source: "nisar" | "sentinel-1" | "synthetic"`, `products[]`, `credits[]`).
- **Grilla por defecto:** 512×512 (~120 m/celda en un bbox de ~60 km). Con 20 fechas, eso da ≈ 10 MB sin comprimir y bastante menos con gzip/brotli, dentro del presupuesto de 15 MB.
- **Por qué no PNG 16-bit ni GeoTIFF/COG en el navegador:** el canvas decodifica a 8 bits y se pierde precisión, y geotiff.js agrega peso y complejidad. Un binario plano se carga con `fetch → ArrayBuffer → Int16Array` sin dependencias.
- **Contrato del esquema:** en Python es un modelo pydantic que emite el JSON. En TS es un esquema Zod que lo valida al cargar. Hay un manifiesto de fixture versionado que ambos test suites validan, para que el contrato no se desvíe.

### D5. Modo sintético para desarrollo en paralelo
- `nisar-pipeline --synthetic` genera el terreno real (DEM) más un "cuenco" gaussiano de subsidencia centrado en Cerro Prieto (~32.40°N, -115.24°W), con `source: "synthetic"`. El frontend se construye contra esto desde el día 1, y la UI muestra el aviso que exige la spec.
- El build final debe tener al menos la capa de Mexicali con `source: "nisar"`. Hay una tarea de verificación para eso.

### D6. Plan B si la cobertura NISAR es insuficiente
- Si el reporte de descubrimiento devuelve menos de 2 fechas útiles sobre Cerro Prieto, el pipeline acepta como entrada GUNW de Sentinel-1 (ARIA) u OPERA DISP-S1, si cubren la zona, con `source: "sentinel-1"`.
- Aun así se incluye en la narrativa al menos un interferograma NISAR disponible, aunque sea un solo par, como capa de fecha única. El reto exige NISAR.
- La decisión se toma tras la tarea de descubrimiento y queda registrada en el README del pipeline.

### D7. Escena 3D: React Three Fiber + drei
- `three`, `@react-three/fiber` y `@react-three/drei`. Se eligen por ser declarativos, encajar con React 19 y tener el ecosistema de helpers más grande (`OrthographicCamera`, `Html`, `useTexture`, `Stats`).
- **Alternativas:** deck.gl, que es muy bueno para mapas pero tiene una estética "GIS" y no está pensado para un control de nave tipo juego; CesiumJS, que es un globo pesado y es un non-goal; Three.js sin React, que obliga a duplicar el manejo de estado con la UI.
- **Terreno:** `PlaneGeometry(W-1, H-1)` con los vértices desplazados en CPU al cargar, a partir de `terrain.bin` × la exageración vertical (por defecto 3×, configurable). Las normales se calculan una vez. A 512² son ~262k vértices, aceptable en GPU de gama media. En móvil se decima 2× (256²).
- **Coloreado:** `MeshStandardMaterial` extendido con `onBeforeCompile`, que conserva la iluminación estándar. Lleva un `DataArrayTexture` (WebGL2) con T capas de desplazamiento como float, uniforms `uDateA`, `uDateB` y `uMix` para interpolar entre fechas (la "transición suave" de la spec), un colormap 1D como textura (divergente y apto para daltonismo, tipo *vik*/*RdBu*), `uOpacity` y un color de "sin dato".
- **Ambiente estilizado:** iluminación direccional cálida, niebla ligera, bordes del diorama con "faldón" de tierra y un fondo de cielo o espacio.

### D8. Cámara isométrica y nave
- **Cámara:** `OrthographicCamera` con azimut 45° y elevación ≈ 35.264° (isométrico verdadero). Va pegada a la nave con un offset fijo y `lerp` amortiguado. El zoom ortográfico (`camera.zoom`) queda limitado entre [min, max] y se controla con la rueda o el pellizco.
- **Nave:** modelo low-poly construido con primitivas de three (sin assets externos ni temas de licencias), con un leve bamboleo y un rastro de partículas. Así queda original.
- **Movimiento:** el vector de entrada WASD/flechas se rota −45° para alinearlo a la pantalla isométrica. Velocidad con aceleración y fricción en `useFrame`. Altura = muestreo bilineal del heightmap en CPU + altura de vuelo constante. Posición limitada al bbox.
- **Clic/tap para volar:** raycast contra la malla del terreno da un objetivo, y la nave se mueve hacia él con *arrive steering*. Cualquier tecla cancela el objetivo.
- **POIs y warp:** al elegir un POI de la misma región, la nave vuela hacia él. Si es de otra región, se hace un fade/efecto de warp (shader de líneas radiales o fundido), se cambia la región en el store, se cargan los assets con TanStack Query y la nave aparece sobre el POI.

### D9. Estado y datos en el frontend
- **`@tanstack/store`** (ya instalado) guarda el estado de UI: región activa, capas visibles/opacidad, `dateIndex`, `playing` y la lectura de la sonda.
- **La posición de la nave vive en un `ref`**, fuera del store, para no re-renderizar React a 60 Hz. Se publica al store cada ~100 ms solo lo que necesita la sonda: coordenadas y el índice de píxel.
- **TanStack Query** (ya configurado) maneja `manifest.json` y los binarios por región, con `staleTime: Infinity` porque los assets son inmutables por build.
- **Sonda:** lee directamente del `Int16Array` del cubo, `cube[t][row][col]`, para el valor y la serie. La mini-gráfica es un SVG simple, sin librería de charts.
- No se usa TanStack DB (el template incluye `db-collections` de ejemplo). No hay datos relacionales ni mutaciones.

### D10. Ruta y SSR
- `src/routes/index.tsx` pasa a ser el explorador con `ssr: false` (selective SSR de TanStack Start). El shell del documento sí se renderiza en el servidor. Hay detección de WebGL2 con un fallback que muestra el contexto narrativo.
- Se actualiza el `<title>` y los metadatos en `__root.tsx`. Los devtools de TanStack se quedan solo en dev.
- **Layout:** el canvas ocupa la pantalla completa y la UI flota encima: shadcn `Slider`, `Switch` y `Button` (ya instalados), más paneles con Tailwind. Se respeta `prefers-reduced-motion`, que desactiva el bamboleo y el warp animado.

### D11. Estructura de código
```
pipeline/                      # Python (uv), fuera del bundle web
  pyproject.toml
  regions.yaml                 # mexicali (subsidence), tijuana (sin capas)
  src/nisar_pipeline/
    config.py  discover.py  download.py  gunw.py
    timeseries.py  dem.py  export.py  manifest.py  synthetic.py  cli.py
  tests/                       # pytest con datos sintéticos pequeños
  .cache/                      # gitignored
public/data/                   # assets generados (versionados)
src/features/explorer/
  manifest.ts                  # Zod + tipos
  store.ts                     # @tanstack/store
  data/                        # queries + decodificación binaria
  scene/                       # Terrain, Ship, IsoCamera, Warp, Atmosphere
  controls/                    # teclado, puntero
  ui/                          # Timeline, Legend, Probe, LayerPanel, PoiList, ContextPanel, Credits, DataNotice
  lib/                         # sampling bilineal, rotación de ejes, colormaps
```
- Tests de TS: se agrega **Vitest** para la lógica pura de `lib/` y `manifest.ts`.

### D12. Modo velocidad y estadísticas (agregado 2026-11-04)
- **Velocidad:** pendiente de mínimos cuadrados por píxel sobre las fechas (cm/año). Se calcula **en el cliente** una vez al cargar el cubo (~4.5 M operaciones, ~decenas de ms) y no en el pipeline, así no cambia el formato de assets ni el manifiesto. Se sube como `DataTexture` 2D float. El shader elige entre el cubo interpolado o la velocidad con `uMode`. El rango de color usa el percentil 1–99 del valor absoluto, para que unos pocos píxeles ruidosos no aplanen la escala.
- **Estadísticas:** se calculan por fecha (máximo, área > umbral × `cellSizeM²`, velocidad media dentro del área) con un recorrido del plano de la fecha (~260 k celdas). Se memorizan por (fecha, umbral) para que la reproducción no las recalcule en cada render.
- **Alternativa descartada:** precalcular en Python. Duplicaría assets y obligaría a cambiar el esquema v1 por algo derivable en cliente.

### D13. Hundimiento 3D exagerado (agregado 2026-11-04)
- **Vertex shader:** muestrea el mismo `DataArrayTexture` (fechas A/B con `uMix`) y desplaza `position.y` en `valor_cm / 100 × N / cellSizeM`, es decir ×N respecto a la escala horizontal del mapa, sin sumar el ×3 del relieve, para que el factor mostrado sea honesto. La normal se perturba con el gradiente del desplazamiento, calculado con 4 muestras vecinas, para que el cuenco se sombree.
- **Huecos sin dato (solo geometría):** si no se desplazaran, quedarían como pilares que sobresalen del cuenco, una pared artificial. Por eso se usa un segundo cubo **solo para la geometría**, donde los huecos se rellenan por dilación iterativa (promedio de vecinos válidos, 8 pasadas ≈ 1 km). Se calcula una vez en el cliente. El color sigue usando el cubo original, así que esos píxeles se ven grises. Los huecos más grandes no se desplazan.
- **Escena y nave:** `heightAt` (vuelo, POIs, picking) suma el mismo desplazamiento de la fecha seleccionada, así la nave y los faros siguen la superficie.
- **Factores:** ×2000 / ×5000 / ×10000 (por defecto ×5000; 13 cm → ~650 m ≈ 5 celdas), con la etiqueta "ilustrativo" visible mientras el modo está activo. Requiere la capa visible.

## Risks / Trade-offs

- **[Cobertura NISAR escasa o productos GUNW aún no publicados para el track]** → la tarea de descubrimiento va primero, mientras el modo sintético desbloquea el frontend. Si falla, se usa el plan B (D6) con aviso en la UI.
- **[Tamaño de descarga de GUNW, varios cientos de MB a GB por producto]** → caché en disco, se descarga solo lo que intersecta el bbox y se usan rangos de fechas acotados en `regions.yaml`.
- **[Errores de desenvolvimiento o atmosféricos producen falsos patrones]** → máscara de coherencia, referencia a una zona estable y, en la narrativa, se aclara que es LOS y que hay ruido. Se valida contra lo publicado sobre Cerro Prieto (subsidencia del orden de cm/año).
- **[Signo de fase ambiguo]** → validación empírica (D2) con un test que fija la convención elegida.
- **[Rendimiento en móviles con 262k vértices]** → decimado a 256² en móvil, `dpr` limitado a [1, 1.5] y sin sombras dinámicas (se usa un sombreado horneado o ambiente).
- **[WebGL2 ausente]** → three r187 / R3F 9 requieren WebGL2, así que sin él no hay escena posible: se muestra el mensaje sin WebGL junto con el contexto narrativo (spec). El fallback a `DataTexture` 2D ya no aplica.
- **[Raycast de R3F contra la malla completa]** → un `onClick` en el terreno hace que R3F haga raycast de ~500 k triángulos en cada evento de puntero o rueda, y eso congelaba el zoom. El clic para volar se resuelve con un recorrido del rayo sobre el heightmap (`lib/pick.ts`) y la malla no tiene handlers de R3F.
- **[Exageración vertical que engaña]** → se muestra el factor en la UI (spec). Por defecto la deformación se representa con **color**. El desplazamiento de la malla por el valor InSAR (D13) es un modo **opcional** que siempre lleva una etiqueta de "ilustrativo" con su factor.
- **[Assets versionados en git inflan el repo]** → presupuesto de 15 MB por región. Si crece, se pasa a Git LFS o a un bucket estático.

## Migration Plan

- Greenfield, sin migración. El deploy es un hosting estático o Nitro del build de Vite con `public/data/` incluido. Rollback = redeploy del commit anterior.
- Para regenerar datos: `cd pipeline && uv run nisar-pipeline --config regions.yaml`, luego commit de `public/data/`.

## Open Questions

- Destino de deploy (Vercel, Netlify o GitHub Pages): no afecta al diseño, porque todo es estático.
- Rango de fechas final de Mexicali: depende del reporte de descubrimiento, y se ajusta en `regions.yaml` sin cambiar código.
- Nombre y branding del proyecto para la entrega.
