# Tasks

## 1. Preparación

- [x] 1.1 Averiguar por qué la capa no se pintó y la sonda dijo "Aún no hay mediciones" en Mexicali a fecha final (cubo cargando o error real); corregirlo si es un error, y si solo era carga mostrar "Cargando mediciones…"; verificar recargando la página
- [x] 1.2 Reemplazar `colorMode` por `mapView` en `store.ts`, `Explorer.tsx`, `Terrain.tsx` y `ui/Probe.tsx` conservando Acumulado y Velocidad; verificar con tests del store y que ambas vistas siguen funcionando en el navegador
- [x] 1.3 Convertir el control en selector de 5 vistas (rejilla de `Segmented`, Aceleración deshabilitada con menos de 4 fechas, selector oculto sin capas); verificar en el navegador a 1440 px y 390 px

## 2. Vista Zonas

- [x] 2.1 Implementar en `lib/impact.ts` el suavizado, la clasificación en bandas, las componentes conexas y el resumen por zona (área, punto extremo, velocidad media), descartando menos de 1 km²; verificar con tests sobre rasters conocidos, incluidos nodata, primera fecha y ruido aislado
- [x] 2.2 Subir la textura de bandas y pintar colores y contornos en `scene/layerMaterial.ts`, memorizando por fecha; verificar en el navegador que los contornos se expanden al reproducir
- [x] 2.3 Implementar `scene/ZoneMarkers.tsx` y `ui/ZoneLabels.tsx` (5 zonas mayores, velocidad media, volar al marcador); verificar en el navegador, también con el hundimiento 3D activo

## 3. Vista Diferencial

- [x] 3.1 Implementar `differentialField` y la LUT secuencial en `lib/colormap.ts`; verificar con tests de un escalón conocido en cm/km y de nodata
- [x] 3.2 Pintar la vista en el shader, con la textura actualizada por fecha; verificar en el navegador que el borde del cuenco resalta más que su centro

## 4. Vista Aceleración

- [x] 4.1 Agregar el término cuadrático a `pipeline/src/nisar_pipeline/synthetic.py` y regenerar los assets; verificar con `uv run pytest` y que el manifiesto valida
- [x] 4.2 Implementar `accelerationField` y pintar la vista; verificar con tests de series aceleradas, frenadas y lineales, y en el navegador

## 5. Explicación y cierre

- [x] 5.1 Adaptar leyenda, sonda y `InfoHint` a cada vista, con las aclaraciones de la spec (no es evaluación de daño, efecto estacional, línea de vista); verificar en el navegador en las 5 vistas
- [x] 5.2 Actualizar el panel de contexto y el README; verificar siguiendo el README
- [x] 5.3 Correr `bun run test`, `bunx tsc --noEmit` y `bunx biome check src/features`, recorrer las vistas a 1440 px y 390 px sin scroll horizontal, y medir unos segundos de FPS reproduciendo en Zonas; verificar que todo pasa y anotar el resultado

## 6. Experiencia inicial

- [x] 6.1 Dejar por defecto hundimiento 3D ×10,000 y reproducción automática (solo con la capa cargada y sin `prefers-reduced-motion`), y mostrar "Fecha: x" abajo a la derecha; verificar con tests del store, TypeScript y Biome

## Notas de verificación

- **Sin prueba en navegador, por decisión del usuario.** Las verificaciones "en el navegador" de las tareas no se ejecutaron. Se verificó con Vitest, pytest, TypeScript, Biome, el build y la compilación de los shaders con `glslangValidator`.
- **Tarea 1.1:** no se determinó la causa de la descarga lenta del cubo en el navegador automatizado (511 KB en 1.8 s, contra 0.08 s con `curl` para el cubo completo). Se agregaron los estados de carga y de error en la sonda; la causa sigue abierta.
- **Tarea 5.3:** los FPS no se midieron.
