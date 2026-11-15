# Proposal

## Why

La HUD del explorador tapa el valle con paneles flotantes (cultivos, capas, modelos, contexto, eventos, créditos, destinos) y obliga a encender plantas y a elegir la exageración del hundimiento. El mapa debe verse de inmediato: cultivos puestos, hundimiento fijo, y el modelo 3D de donde está la nave en un recuadro aparte, sin menús encima.

## What Changes

- En Mexicali, los modelos de cultivo en el terreno SHALL estar siempre visibles. No hay interruptor «Cultivos» ni se apagan al cerrar un panel. **BREAKING** respecto al `crops: agriOpen` actual.
- El hundimiento 3D SHALL quedar siempre encendido con factor **×2000**. Se quita el control de exageración (5000 / 10000) y el interruptor de Ajustes. **BREAKING**.
- Se desactiva el menú de capas (`LayerPanel` y el ítem Capas del dock). El mapa permanece en la vista de hundimiento acumulado.
- Se quita el menú de modelos (botón, panel y catálogo para volar a un cultivo).
- Cuando la nave está parada, un view dedicado muestra el modelo 3D más cercano al probe (cultivo, casa, edificio o auto), sin volar ni abrir un menú.
- Se quitan los menús flotantes actuales: Cultivos, Eventos, Modelos, Contexto, Créditos, Capas, Destinos (`PoiList` overlay) y el inspector de toque. Quedan el lienzo, la línea de tiempo y el view del modelo.
- Se quita el menú de contexto científico. Esas reglas de HUD se documentan en `AGENTS.md` para que no se vuelvan a añadir paneles flotantes.
- La alineación del mapa a datasets extra de NASA queda fuera: ya vive en `ground-explorer-in-nasa-resources`.

## Capabilities

### New Capabilities

- `locked-scene-defaults`: cultivos siempre en el valle y hundimiento 3D fijo en ×2000, sin controles para apagarlos o subir la exageración.
- `bare-explorer-chrome`: HUD sin paneles flotantes de herramientas (capas, modelos, contexto, eventos, créditos, cultivos, destinos).
- `parked-model-view`: recuadro 3D del modelo bajo la nave cuando está en reposo.

### Modified Capabilities

- (ninguna: `openspec/specs/` está vacío; los deltas de otros changes no están archivados)

## Impact

- `src/features/explorer/Explorer.tsx`, `store.ts`, `ui/TopBar.tsx`, `ui/LayerPanel.tsx`, `ui/ModelsPanel.tsx`, `ui/MobileDock.tsx`, `ui/SettingsDialog.tsx`, `ui/Overlays.tsx`, `ui/AgriculturePanel.tsx`, `lib/mapModels.ts`, tests del store y de modelos.
- `AGENTS.md`: reglas permanentes de HUD (sin menús flotantes, cultivos on, deform ×2000, modelo en view dedicado).
- No toca el pipeline NISAR ni los cubos. No implementa el change incompleto `keep-crops-on-and-guess-by-zone` (estimación por zona); solo deja las plantas siempre visibles.
