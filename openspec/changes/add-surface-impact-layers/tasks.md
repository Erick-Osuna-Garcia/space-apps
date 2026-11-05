# Tasks

## 1. Datos reales base

- [x] 1.1 Terminar `add-nisar-isometric-explorer` 3.3, 3.4 y 3.6: procesar los recortes GUNW de Mexicali, validar el signo con Cerro Prieto y fijarlo en un test; verificar que `manifest.json` queda con `source: "nisar"`
- [x] 1.2 Agregar a `regions.yaml` el stack de Tijuana y generar su capa de desplazamiento; verificar el manifiesto y que el punto de referencia tiene datos

## 2. Modelo de capas v2

- [x] 2.1 Migrar el manifiesto a v2 en `manifest.py` y `manifest.ts` (tema, unidades, pintura, clases, capas estáticas y vectoriales) con el fixture compartido; verificar con pytest y Vitest
- [x] 2.2 Implementar el render genérico en `layerMaterial.ts` y `Terrain.tsx`, pasando Acumulado, Velocidad, Zonas, Diferencial y Aceleración a ese camino sin perder el 3D; verificar con tests y `glslangValidator`
- [x] 2.3 Implementar el catálogo por temas con carga bajo demanda, estados de carga y error, y la línea de tiempo por capa (fecha más cercana, capas estáticas); verificar con tests del store
- [x] 2.4 Implementar el inspector (lectura pura de capas cargadas, "Sin dato", vuelo al punto); verificar con tests
- [x] 2.5 Medir el presupuesto por capa en `export.py` y cargar créditos y fuente por capa; verificar con pytest

## 3. Superficie con GCOV

- [x] 3.1 Abrir un producto GCOV real, confirmar rutas y medir el tiempo de un recorte; verificar anotando en `pipeline/README.md` el tiempo y las fechas viables
- [x] 3.2 Implementar `gcov.py`, la selección mensual por stack y las capas HH y HV; verificar con un HDF5 sintético y un producto real
- [x] 3.3 Implementar la capa de detección de cambios; verificar con tests de umbral y ruido
- [x] 3.4 Implementar la capa de agua (permanente y nueva, sin sombras por pendiente); verificar con tests sobre rasters conocidos

## 4. Disturbios y descomposición

- [x] 4.1 Implementar la capa de disturbios a partir de los recortes GUNW ya descargados; verificar con tests de caídas de coherencia
- [x] 4.2 Leer geometría de GUNW y descargar el stack descendente; verificar con un producto real
- [x] 4.3 Implementar la descomposición vertical y este-oeste; verificar con tests que recuperan un movimiento conocido
- [x] 4.4 Implementar las capas y las flechas con `InstancedMesh`; verificar con tests de la rejilla

## 5. Humedad

- [x] 5.1 Abrir un producto SME2 real, confirmar rutas y unidades, y generar la capa mensual; verificar con un producto real

## 6. Impacto

- [x] 6.1 Generar pendiente y laderas activas; verificar con tests sobre un DEM conocido
- [x] 6.2 Descargar ESA WorldCover y WorldPop a la grilla, con créditos; verificar sumas y clases con tests
- [x] 6.3 Descargar caminos y canales de OpenStreetMap, simplificar y exportar con caché; verificar con una consulta real y un test de conversión a grilla
- [x] 6.4 Dibujar infraestructura, resaltar tramos por fecha y mostrar km afectados; verificar con tests del cruce
- [x] 6.5 Sumar población y uso de suelo a las etiquetas de zona, y tocar tramos en el inspector; verificar con tests
- [x] 6.6 Buscar una fuente pública de producción geotérmica; agregarla como contexto solo si existe, y documentar el resultado en `pipeline/README.md`

## 7. Integración

- [x] 7.1 Actualizar ayuda, leyendas, panel de contexto, créditos y README con todas las capas y sus límites; verificar que ninguna capa de impacto afirma daño
- [x] 7.2 Correr `bun run test`, `bunx tsc --noEmit`, `bunx biome check src/features`, `uv run pytest` y `bun run build`; verificar que pasan y que los assets cumplen el presupuesto

## 8. Ajustes y estado de la nave

- [x] 8.1 Dejar caminos y canales encendidos por defecto y mover los interruptores a un modal de Ajustes; verificar con tests del store, TypeScript y Biome
- [x] 8.2 Quitar el panel de resumen y sustituir la sonda por el tablero de estado de la nave; verificar con tests de velocidad y rumbo

## Notas de verificación

- **Sin prueba en navegador, por decisión del usuario.** La UI nueva se verificó con Vitest, TypeScript, Biome, el build y `glslangValidator`, no en pantalla.
- **Datos comprobados contra hechos conocidos:** población de 1.09 M en Mexicali y 2.05 M en Tijuana; mar de Tijuana como agua permanente (9.7 %); referencia con −0.4 cm/año vertical; Cerro Prieto con −6.5 cm/año vertical.
- **Tarea 6.6:** no se encontró una serie oficial de producción geotérmica; la capa se omitió.
- **Umbrales de agua y cambios:** se calibraron con pocas comprobaciones; pueden dar falsos positivos.
