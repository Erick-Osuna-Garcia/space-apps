# Proposal

## Why

El reto pide traducir el radar en información útil sobre "patterns and rhythms of Earth's surface". El explorador colorea el desplazamiento, pero el usuario tiene que interpretar un degradado para saber dónde está el problema. Queremos que el impacto se vea **directamente sobre el mapa**, sin gráficas de estadísticas: qué zonas quedaron más bajas o más altas, dónde se concentra el hundimiento, dónde el terreno se dobla y dónde se acelera.

## What Changes

- Nuevo **selector de vistas** en el panel de capas, con una vista a la vez: Acumulado, Velocidad, Zonas, Diferencial y Aceleración. Reemplaza el control Acumulado/Velocidad actual.
- Nueva **vista Zonas**: el terreno se divide en zonas más bajas (hundimiento bajo, medio y alto) y más altas (el suelo se acercó al satélite), con contornos que se expanden al avanzar el tiempo. Cada zona principal lleva un marcador en su punto extremo y una etiqueta con su velocidad media.
- Nueva **vista Diferencial**: resalta dónde el terreno se dobla porque un lado baja más que el otro.
- Nueva **vista Aceleración**: muestra dónde el hundimiento se acelera y dónde se frena.
- La leyenda, la sonda y la ayuda se adaptan a la vista activa.
- **Fuera de alcance:**
  - Gráficas de estadísticas, descartadas por el usuario.
  - Cortina antes/después, perfil A–B, cambio entre dos fechas y zonas por nivel de velocidad.
  - Tour guiado y fenómenos GCOV, ya registrados para después.

## Capabilities

### New Capabilities
- `map-impact-views`: vistas de impacto sobre el mapa derivadas de las capas de desplazamiento: selector de vistas, zonas con contorno, marcador y etiqueta, hundimiento diferencial y aceleración.

### Modified Capabilities
<!-- Ninguna: las specs de add-nisar-isometric-explorer aún no están archivadas en openspec/specs/. -->

## Impact

- **Depende de** `add-nisar-isometric-explorer`, que sigue abierto. Este change reemplaza su selector de color y usa sus indicadores amigables (grupo 9), así que conviene terminarlo primero.
- **Código:** `src/features/explorer/`: `store.ts`, `Explorer.tsx`, `scene/layerMaterial.ts`, `scene/Terrain.tsx`, `ui/LayerPanel.tsx`, `ui/Probe.tsx`, más `lib/impact.ts`, `scene/ZoneMarkers.tsx` y `ui/ZoneLabels.tsx` nuevos.
- **Pipeline:** solo un ajuste en `synthetic.py` para que la aceleración se pueda probar. Sin cambios en el manifiesto.
- **Sin dependencias nuevas.**
