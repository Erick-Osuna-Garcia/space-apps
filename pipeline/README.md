# nisar-pipeline

Pipeline **offline** que convierte datos de radar NISAR y el DEM Copernicus en assets estáticos para el explorador isométrico (`public/data/`). La app web no procesa SAR ni necesita credenciales; solo lee estos archivos.

```
ASF DAAC (NISAR L2 GUNW) ─┐
                          ├─► nisar-pipeline ─► public/data/manifest.json
Copernicus DEM (AWS) ─────┘                     public/data/<region>/terrain.bin
                                                public/data/<region>/<capa>/cube.bin
```

## Instalación

Requiere [uv](https://docs.astral.sh/uv/). uv instala Python 3.12 automáticamente si hace falta.

```bash
cd pipeline
uv sync
uv run nisar-pipeline --help
uv run pytest          # tests
```

## Modo sintético

```bash
uv run nisar-pipeline --synthetic
```

Genera el **terreno real** (Copernicus DEM, público y sin login) más una capa de subsidencia **sintética**: un cuenco gaussiano de unos −12 cm/año centrado en Cerro Prieto, con una parte que se acelera, ruido y parches sin dato. Sirve para desarrollar el frontend sin esperar a los datos NISAR. El manifiesto marca la capa con `source: "synthetic"` y la web muestra un aviso permanente. **No se debe entregar así**: ver "Datos NISAR reales".

## Credenciales NASA Earthdata

Solo se necesitan para descargar NISAR desde ASF.

1. Crea una cuenta gratuita en <https://urs.earthdata.nasa.gov/users/new>.
2. Configura **una** de estas opciones:
   - `~/.netrc` (recomendado):
     ```
     machine urs.earthdata.nasa.gov login TU_USUARIO password TU_PASSWORD
     ```
     y luego `chmod 600 ~/.netrc`.
   - Variables de entorno `EARTHDATA_USERNAME` y `EARTHDATA_PASSWORD`, o un token en `EARTHDATA_TOKEN`.

El pipeline nunca escribe credenciales en logs, reportes ni assets.

## Datos NISAR reales

```bash
uv run nisar-pipeline              # descubre, descarga, procesa y exporta
```

Para cada región con capas, el pipeline:

1. **Descubre** productos NISAR L2 GUNW que intersectan el bbox y el rango de fechas (`asf_search`) y escribe `.cache/<region>/<capa>/discovery.json`. Si no hay productos, termina con un error que dice qué buscó.
2. **Descarga el recorte** de cada producto: abre el HDF5 remoto (lectura por rangos HTTPS), lee la ventana del bbox y la guarda en `.cache/<region>/<capa>/subsets/` (fuera de git). Los recortes que ya están completos no se vuelven a descargar.
3. **Remuestrea** la fase desenvuelta, la coherencia y la pantalla ionosférica a la grilla de la región.
4. La **pantalla ionosférica** no se resta por defecto (ver "Decisiones de datos"); se puede activar con `ionosphere_correction: true`.
5. Convierte la fase a **desplazamiento LOS** en cm (λ = c / `centerFrequency`, ≈ 0.24 m), le resta la mediana de la zona estable de referencia (`reference_bbox`) e **invierte** la red de interferogramas por mínimos cuadrados (SBAS simplificado; con pares consecutivos equivale a una suma acumulada). Los píxeles con coherencia media menor al umbral quedan sin dato.

Para revisar la cobertura a mano antes de correrlo, usa [Vertex](https://search.asf.alaska.edu/) (filtro: NISAR, L2 GUNW, dibuja el área de Mexicali) o Earthdata Search.

### Decisiones de datos

**Revisión del 2026-11-04: se usa NISAR, sin plan B.** Todos los productos son PROVISIONAL (CRID P05023).

| Stack | Dirección | Pares | Cobertura Mexicali | Uso |
|---|---|---|---|---|
| **85/72** | Descendente | 26 | 95 % | Principal |
| **106/18** | Ascendente | 22 | 100 % | Segundo, para vertical y este-oeste |
| 5/18 | Ascendente | 27 | 53 % | Descartado: deja fuera la referencia |
| 157/72 | Descendente | 13 | 100 % | Descartado: pocos pares |

**Cómo se procesa y por qué:**
- Sin corrección ionosférica: restarla par por par acumula su error y borró la señal del campo.
- Se quita un plano por interferograma, ajustado en píxeles coherentes lejos del campo.
- Solo se usa la componente conexa principal.
- Los huecos (incluido el par faltante 20-jun → 2-jul) se llenan con la velocidad media del píxel, si tiene al menos 70 % de pares válidos.
- La serie se suaviza con una media móvil de 5 fechas: quedan ±2–3 cm de ruido por fecha.

**Validación del signo:** el campo de Cerro Prieto sale negativo (el suelo se aleja del satélite), como se espera. La magnitud medida es ~−3.5 cm/año en línea de vista, con un año de datos y una sola órbita.

**Tiempos:** un recorte GUNW tarda ~35 s y uno GCOV ~3 min (viene a 10 m; se promedia a 80 m). Por eso GCOV y SME2 usan una escena por mes.

**Producción geotérmica:** no se agregó. La búsqueda del 2026-11-04 solo dio cifras secundarias y contradictorias de capacidad, sin una serie oficial de producción del campo para este periodo. Si se consigue una de CFE o SENER, puede sumarse como contexto.

## Configuración (`regions.yaml`)

| Campo | Significado |
|---|---|
| `max_grid_size` | Celdas en el lado mayor de la grilla de cada región (por defecto 512). |
| `size_budget_mb` | Presupuesto de assets por región (hoy ~52 MB). |
| `projection` | CRS métrico (UTM 11N). |
| `regions[].bbox` | `[minLon, minLat, maxLon, maxLat]` WGS84. |
| `regions[].layers[]` | Capa de desplazamiento (GUNW), con `stack` y `secondary_stack`. |
| `regions[].extras` | Capas adicionales: `slope`, `active-slopes`, `landcover`, `population`, `infrastructure`, `disturbance`, `decomposition`, `surface` (GCOV), `moisture` (SME2). Si una falla, se registra y las demás se generan. |
| `infrastructure` | Escribe `roads.json`, `canals.json` y, si OpenStreetMap responde, `rivers.json` (`waterway=river`). El overlay de ríos es opcional: sin ese archivo la app sigue con canales y agua. No hace falta reprocesar NISAR para agregarlo. |
| `layers[].reference_bbox` | Zona estable (roca) que se usa como referencia de desplazamiento 0. |

## Formato de assets

Todos los binarios son **Int16 little-endian**, en orden fila-mayor, con la fila 0 al **norte**.

| Archivo | Forma | Unidades |
|---|---|---|
| `<region>/terrain.bin` | `height × width` | metros |
| `<region>/<capa>/cube.bin` | `fechas × height × width` | mm (multiplicar por `scale` = 0.1 para obtener cm). `-32768` = sin dato. |

`manifest.json` (esquema v2, ver `src/nisar_pipeline/manifest.py`) describe por región el bbox, las esquinas lon/lat de la grilla, el tamaño de celda, los POIs en coordenadas de grilla y, por capa, las fechas, el rango de valores, `source` (`nisar`, `sentinel-1` o `synthetic`), los ids de productos fuente y los créditos. El esquema se espeja en `src/features/explorer/manifest.ts`, y ambos lados validan `tests/fixtures/manifest.sample.json`.

`<región>/events.json` guarda los eventos de impacto que calcula `events.py` a partir de las capas NISAR. La historia con Sentinel-1 (`opera.py`, clave `history` de la capa) es opcional y `regions.yaml` no la activa.

Si se re-ejecuta con los mismos datos, se obtienen archivos idénticos: `generatedAt` solo cambia si cambia el contenido.

## Créditos

- NISAR: NASA/JPL-Caltech e ISRO, distribuidos por el ASF DAAC.
- Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
