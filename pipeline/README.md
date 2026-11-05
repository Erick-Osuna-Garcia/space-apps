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
4. Resta la **pantalla ionosférica**: el producto la incluye pero no la aplica, y en banda L importa. Se puede desactivar con `ionosphere_correction: false`.
5. Convierte la fase a **desplazamiento LOS** en cm (λ = c / `centerFrequency`, ≈ 0.24 m), le resta la mediana de la zona estable de referencia (`reference_bbox`) e **invierte** la red de interferogramas por mínimos cuadrados (SBAS simplificado; con pares consecutivos equivale a una suma acumulada). Los píxeles con coherencia media menor al umbral quedan sin dato.

Para revisar la cobertura a mano antes de correrlo, usa [Vertex](https://search.asf.alaska.edu/) (filtro: NISAR, L2 GUNW, dibuja el área de Mexicali) o Earthdata Search.

### Decisión de datos (plan B)

**Revisión del 2026-11-04 → se usa NISAR. No hace falta el plan B (Sentinel-1).**

La búsqueda sobre el bbox de Mexicali (oct-2025 → oct-2026) encontró 101 productos GUNW. Los stacks que cubren Cerro Prieto son:

| Track (relative orbit) | Frame | Dirección | Pares únicos |
|---|---|---|---|
| **5** | **18** | **Ascendente** | **27** ← elegido |
| 85 | 72 | Descendente | 26 |
| 106 | 18 | Ascendente | 22 |
| 157 | 72 | Descendente | 13 |

- El stack elegido tiene 28 fechas, del 2025-10-29 al 2026-10-12, y forma una cadena de pares de 12 días **conectada** (hay dos saltos de 24 días: oct→nov 2025 y jul→ago 2026).
- Todos los productos son **PROVISIONAL, CRID P05023** (calibrados). No se mezclan con BETA.
- Los ids exactos de los productos quedan en `.cache/mexicali/subsidence/discovery.json` y, al exportar, en `manifest.json` → `layers[].products`.
- Para fijar otro stack (p. ej. el descendente 85/72 y comparar geometrías), agrega `stack: {relative_orbit: 85, frame: 72}` a la capa en `regions.yaml`.

**Tamaño:** los 27 HDF5 completos suman unos 62 GB. Por eso el pipeline **no descarga los archivos completos**: los abre por HTTPS con `earthaccess`, lee con h5py solo la ventana del bbox de la región (fase, coherencia e ionosfera, a 80 m) y guarda ese recorte en `.cache/` (unos MB por producto).

## Configuración (`regions.yaml`)

| Campo | Significado |
|---|---|
| `max_grid_size` | Celdas en el lado mayor de la grilla de cada región (por defecto 512). |
| `size_budget_mb` | Presupuesto de assets por región. Si se excede, baja la resolución automáticamente y, si aun así no cabe, falla. |
| `projection` | CRS métrico común (UTM 11N cubre Mexicali y Tijuana). |
| `regions[].bbox` | `[minLon, minLat, maxLon, maxLat]` WGS84. |
| `regions[].layers[]` | Capas a generar. Hoy solo existe `type: los-displacement` (GUNW). Una región sin capas genera solo terreno. |
| `layers[].reference_bbox` | Zona estable (roca) que se usa como referencia de desplazamiento 0. |

## Formato de assets

Todos los binarios son **Int16 little-endian**, en orden fila-mayor, con la fila 0 al **norte**.

| Archivo | Forma | Unidades |
|---|---|---|
| `<region>/terrain.bin` | `height × width` | metros |
| `<region>/<capa>/cube.bin` | `fechas × height × width` | mm (multiplicar por `scale` = 0.1 para obtener cm). `-32768` = sin dato. |

`manifest.json` (esquema v1, ver `src/nisar_pipeline/manifest.py`) describe por región el bbox, las esquinas lon/lat de la grilla, el tamaño de celda, los POIs en coordenadas de grilla y, por capa, las fechas, el rango de valores, `source` (`nisar`, `sentinel-1` o `synthetic`), los ids de productos fuente y los créditos. El esquema se espeja en `src/features/explorer/manifest.ts`, y ambos lados validan `tests/fixtures/manifest.sample.json`.

Si se re-ejecuta con los mismos datos, se obtienen archivos idénticos: `generatedAt` solo cambia si cambia el contenido.

## Créditos

- NISAR: NASA/JPL-Caltech e ISRO, distribuidos por el ASF DAAC.
- Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
