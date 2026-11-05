# Design

## Context

- Búsqueda en ASF del 2026-11-04 (región: productos, órbitas principales):
  - **Mexicali:** GUNW 100 (5/18 A, 85/72 D, 106/18 A, 157/72 D); GCOV 115 (~6.7 GB c/u); SME2 113 (~0.12 GB); **GOFF 0**.
  - **Tijuana:** GUNW 106 (85/72 D, 34/18 A, 13/72 D, 106/18 A); GCOV 120; SME2 117; **GOFF 1**.
- Probado con un producto real: `earthaccess` + h5py lee un recorte GUNW en ~35 s. El producto viene en EPSG:32612, no en la 32611 de la grilla.
- El manifiesto v1 fija `units: "cm"` y un único `colormap`; el shader tiene modos fijos (`PaintMode`) y el selector de `add-map-impact-views` es plano.
- ESA WorldCover y WorldPop respondieron desde esta máquina. Overpass devolvió 406 a una consulta sin parámetros, así que falta confirmarlo con una consulta real.
- Motivación y alcance: `proposal.md`. Comportamiento: `specs/`.

## Goals / Non-Goals

**Goals:**
- Un modelo de capas genérico: agregar una capa no debe tocar el shader.
- Toda la lógica nueva en funciones puras con tests.

**Non-Goals:**
- Clasificar cultivos por especie ni atribuir causas.
- Evaluar daño estructural o riesgo.
- Componente norte-sur.

## Decisions

### D1. Manifiesto v2 con capas descriptivas
`schemaVersion: 2`. Cada capa declara `theme`, `units` (texto libre), `paint` (`diverging`, `sequential`, `categorical`), `palette` y, si es categórica, `classes` (valor, nombre, color). `dates` puede ir vacío para capas estáticas, con `referenceDate`. Las capas vectoriales van en `region.overlays`, como JSON simplificado en coordenadas de grilla. Pydantic y Zod cambian juntos, con el fixture compartido actualizado. **Alternativa:** seguir con un tipo por capa en código, lo que obligaría a tocar el shader 13 veces.

### D2. Render genérico
La capa activa se sube como textura 2D de la fecha actual, y el shader reutiliza sus modos de campo y bandas con una LUT por paleta (sin transición entre fechas para estas capas). Las vistas actuales pasan a ese camino. El cubo de hundimiento sigue en `DataArrayTexture` porque el 3D depende de él, así que **el hundimiento 3D sigue activo sobre cualquier capa**.

### D3. Fechas mensuales para GCOV y SME2
Un recorte GCOV de 60 km a 20 m son ~72 MB por producto, mucho más que GUNW. Se toma un producto por mes del mismo stack (~12 fechas), se remuestrea a la grilla y se lee en paralelo. **Riesgo principal de tiempo:** se mide con un solo producto antes de lanzar el resto. Si es inviable, se reducen fechas, no capas.

### D4. Retrodispersión, cambios y agua
- `gcov.py` lee `HHHH` y `HVHV` de `/science/LSAR/GCOV/grids/frequencyA` (rutas por confirmar con un producto real) y exporta dB × 100 en Int16.
- **Cambios:** diferencia en dB contra la primera fecha sobre el campo suavizado, con umbral de ±3 dB.
- **Agua:** un umbral fijo falló con datos reales: el mar mide −18 dB y la arena seca del desierto ~−20 dB. La permanente viene del mapa de cobertura, y la nueva es una caída de 5 dB o más respecto a la mediana del píxel, por debajo de −14 dB y con pendiente < 10°. Salida categórica por fecha en Uint8.

### D5. Disturbios por coherencia
Los recortes GUNW ya incluyen coherencia, así que no se descarga nada nuevo. Por píxel: mediana de la serie; se marca disturbio donde cae más de 0.3 por debajo de esa mediana.

### D6. Descomposición
Se añaden `incidenceAngle` y `losUnitVectorX/Y` de `/science/LSAR/GUNW/metadata/radarGrid`, interpolados a la altura del terreno. Por píxel se resuelve un sistema 2×2 con las velocidades de ambas órbitas, ignorando el norte-sur (sensibilidad baja). Se usan velocidades, no series, porque las fechas de cada órbita no coinciden. **Prerrequisito:** validar el signo con datos reales (tarea 3.6 de `add-nisar-isometric-explorer`).

### D7. Flechas
`InstancedMesh` sobre una rejilla adaptada al zoom, con dirección y largo según el este-oeste. Nunca handlers de R3F sobre geometría pesada.

### D8. Datos auxiliares
- **Uso de suelo:** ESA WorldCover 10 m (2021), remuestreado por moda.
- **Población:** WorldPop a 1 km (México y EE. UU.), por suma de personas por celda. El de 100 m pesa 1 GB y su servidor no admite lecturas por rangos.
- **Caminos y canales:** OpenStreetMap vía Overpass, filtrando vías principales y `waterway=canal`, simplificado y guardado en GeoJSON. Las respuestas se cachean para no repetir consultas.
- **Pendiente:** derivada del DEM ya descargado.

**Producción geotérmica:** sin fuente pública verificada. Si se consigue, entra como dato de contexto; si no, se omite. No se inventan valores.

### D9. Cruce de infraestructura en el cliente
Cada tramo se precalcula en celdas de grilla; al cambiar de fecha se evalúa contra las bandas de `lib/impact.ts`, y se dibuja con `LineSegments` y color por vértice. Las etiquetas de zona suman población y uso de suelo con los rasters auxiliares.

### D10. Inspector
`pick` en `IsoCamera` publica también el punto en el store. Una función pura lee todas las capas ya cargadas; las no descargadas se piden en ese momento a baja prioridad. Para tocar caminos se busca el tramo más cercano recorriendo los tramos, sin raycast.

### D11. Catálogo en la HUD
Panel de capas con pestañas por tema. Sustituye al selector de vistas; Zonas, Diferencial y Aceleración pasan a ser capas del tema Movimiento. En móvil, una hoja inferior.

### D12. Presupuesto de assets
~80 MB por región, 16 MB por capa, medido por capa en `export.py`. Int16 para continuas y Uint8 para categóricas. **Riesgo:** ~160 MB en git; si molesta, se mueven a un bucket o Git LFS.

### D13. Lo que aprendimos de los datos reales (2026-11-04)
- **Stacks:** elegir por número de pares fue un error: 5/18 tiene 27 pares pero cubre 53 % de Mexicali y deja fuera la referencia. Se usa **85/72 descendente** (95 %) como principal y **106/18 ascendente** (100 %) como segundo; ambos cubren también Tijuana. La selección automática ahora pondera cobertura.
- **Ionosfera:** restar `ionospherePhaseScreen` par por par **acumula su error** en la cadena y borró la señal de Cerro Prieto (suma −0.5 cm contra −4 cm sin restarla). Sumando sin corrección, la atmósfera de las fechas intermedias se cancela. Por eso `ionosphere_correction` queda en `false`.
- **Rampa:** se quita un plano por interferograma, ajustado en píxeles coherentes y lejos del campo.
- **Máscara:** solo se usa la componente conexa principal del desenvolvimiento.
- **Huecos:** falta el par 20-jun → 2-jul. Los huecos se llenan con la velocidad media del píxel (mínimo 70 % de pares válidos). Es una interpolación y se documenta.
- **Ruido:** quedan ±2–3 cm por fecha, así que la serie se suaviza con una media móvil de 5 fechas.
- **Atípicos:** los errores de desenvolvimiento en parcelas daban −170 cm. Se descartan los píxeles a más de 8 cm de la mediana de su bloque o por encima de 30 cm, y el rango de color usa percentiles.
- **Signo:** validado: el sector del campo sale negativo.
- **Magnitud:** −3.5 cm/año en línea de vista en el campo, de un solo año y una sola órbita, menor que las cifras históricas.

## Risks / Trade-offs

- **[Tiempo de GCOV]** → medir primero, reducir fechas si hace falta. Es la parte que puede no caber en el hackathon.
- **[Signo y calidad NISAR sin validar]** → las capas de movimiento derivadas esperan la validación.
- **[Umbrales de agua y cambios]** → se calibran con datos reales y se documentan; pueden marcar falsos positivos.
- **[Tamaño del change]** → grupos ordenados: si falta tiempo se puede cortar tras cualquiera y el explorador sigue funcionando.
- **[Credenciales]** → el token del usuario solo existe en la sesión; para re-ejecutar hace falta configurar `~/.netrc` o `EARTHDATA_TOKEN`.
- **[Mapa saturado]** → una capa principal a la vez, superposiciones opcionales.
- **[Datos de terceros de otra fecha]** → WorldCover es de 2021 y WorldPop no es censo: el inspector indica fecha y fuente.

## Migration Plan

Manifiesto v1 → v2 en un solo paso, regenerando assets. Rollback = revertir los commits y los assets.

## Open Questions

- Las rutas exactas de GCOV y SME2 se confirman abriendo un producto real (tareas 3.1 y 5.1), sin cambiar el enfoque.
