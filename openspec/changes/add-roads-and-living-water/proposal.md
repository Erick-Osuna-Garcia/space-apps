# Proposal

## Why

Los caminos y canales de OpenStreetMap se dibujan como líneas de 1 píxel, todas iguales, aunque los datos ya distinguen el tipo de vía. Lagos y lagunas son color plano, y con la capa por defecto quedan tapados por el gris de "sin dato", así que el agua medida por NISAR casi no se percibe fuera de su capa.

## What Changes

- **Caminos con cuerpo:** cintas con ancho y borde según el tipo de vía, pegadas al terreno, que siguen el hundimiento 3D sin saltos.
- **Detalle según el zoom:** de lejos solo las vías grandes y al acercarse las demás. Los tramos afectados se ven siempre.
- **Agua viva:** superficie animada en lagos y canales.
- **Agua que reacciona:** la nave deja ondas al pasar sobre el agua, y tocar el agua crea una onda.
- **Agua que cambia con el tiempo:** la extensión sigue las fechas medidas por NISAR, con el agua nueva distinguida de la permanente.
- **Ajuste y aclaración:** un interruptor en Ajustes apaga la animación, y se aclara que las olas son decorativas y la extensión es medida.
- **Fuera de alcance:** calles terciarias y residenciales, nombres de vías sobre el mapa, y cualquier descarga o regeneración de datos.

## Capabilities

### New Capabilities
- `map-roads`: cómo se dibujan caminos y canales sobre el terreno según su tipo y el zoom.
- `living-water`: cómo se ve, se anima y reacciona el agua, y cómo sigue las mediciones por fecha.

### Modified Capabilities
<!-- Ninguna: no hay specs archivadas en openspec/specs/. -->

## Impact

- **Web:** `scene/Infrastructure.tsx`, `scene/layerMaterial.ts`, `scene/Terrain.tsx`, `scene/Scene.tsx`, `scene/IsoCamera.tsx`, `lib/infrastructure.ts`, `ui/SettingsDialog.tsx`, `store.ts`, `Explorer.tsx` y lógica pura nueva en `lib/`.
- **Pipeline y assets:** sin cambios. Se usan `roads.json`, `canals.json` y `water/cube.bin` tal como están.
- **Carga:** el cubo de agua (3.4 MB) pasa a cargarse siempre, en segundo plano.
