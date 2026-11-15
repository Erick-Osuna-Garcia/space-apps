# Design

## Context

Hoy `placeMapModels` pone cultivos solo si `agricultureOpen`. El hundimiento usa `deform3d` y `deformFactor` (default 10000) desde Ajustes. La HUD en `Explorer.tsx` apila `TopBar` (Cultivos, Eventos, Modelos, Ajustes, Contexto, Créditos), `PoiList`, paneles laterales, `LayerPanel`, `Inspector`, `ShipStatus` y `MobileDock`. `ModelsPanel` carga GLB de `public/models/crops` y vuela la nave. Ver `proposal.md` para el motivo y los specs de este change para el comportamiento.

## Goals / Non-Goals

**Goals:**

- Un chrome mínimo: canvas + timeline + recuadro del modelo.
- Cultivos en el valle sin depender de estado de panel.
- Deformación siempre ×2000 en código, no en UI.
- Recuadro que sigue al probe en reposo (`hypot(vx,vz) < 0.5`, el mismo umbral que `Scene` ya usa para «en movimiento»).
- Dejar las reglas en `AGENTS.md` para que no se reintroduzcan menús flotantes.

**Non-Goals:**

- Estimar el cultivo por zona (HV + humedad); eso es `keep-crops-on-and-guess-by-zone`.
- Añadir datasets NASA; eso es `ground-explorer-in-nasa-resources`.
- Nuevos GLB de casas, autos o cultivos sin archivo.
- Quitar las etiquetas in-scene de POI/zonas (no son menús).

## Decisions

### D1. Cultivos con `crops: true` en Mexicali

`placeMapModels` recibe `crops: region.id === "mexicali"` cuando hay landcover. Se elimina `agricultureOpen` del store y el panel agrícola, o se deja el estado muerto si algún test interno aún lo usa: preferir borrarlo.

Alternativa: panel siempre abierto. Se descarta porque viola `bare-explorer-chrome`.

### D2. Factor 2000 constante

`deform3d` queda `true`. `deformFactor` inicial y único es `2000`. Se quitan `setDeform3d`, `setDeformFactor`, `DEFORM_FACTORS` extra y el bloque Relieve de `SettingsDialog`. Si Ajustes queda sin filas útiles, se elimina el diálogo y el botón.

Alternativa: dejar Ajustes solo para caminos/agua. Se descarta: overlays ya están on por defecto y el spec no deja menús de herramientas.

### D3. Recuadro con el modelo más cercano, no el catálogo

Función pura `nearestAnyModel(models, probe, maxCells)` (radio ~8 celdas, alineado a `nearestModel` actual sin filtrar `kind`). Si hay GLB para ese `CropId`, el recuadro reutiliza el `Canvas` de `ModelsPanel` (`FitModel`). Casas, edificios, autos y cultivos sin GLB se dibujan con las mismas primitivas que `MapModels` en un canvas chico. En vuelo o sin hit: texto, no un GLB residual.

El recuadro vive anclado (p. ej. esquina inferior opuesta a la timeline), `pointer-events` solo dentro de sí, sin volar la nave.

Alternativa: seguir usando el panel de catálogo. Se descarta por el spec.

### D4. HUD por eliminación, no por CSS hide

Quitar de `Explorer.tsx` el montaje de `LayerPanel`, `ModelsPanel`, `AgriculturePanel`, `EventsList`, `ContextContent`, `CreditsContent`, `Inspector`, `PoiList`, `TopBar` de botones, `ShipStatus`, `MobileDock` y `SettingsDialog`. Timeline + `DateTitle` se quedan abajo. Un `ParkedModelView` nuevo.

`mapView` permanece `"cumulative"`; no hay `setView` desde UI. Los pick del terreno ya no abren inspector ni agricultura.

### D5. `AGENTS.md`

Tras el bloque de Intent, una sección corta «Explorer HUD» con: cultivos siempre on; hundimiento ×2000; sin menús flotantes (capas, modelos, contexto, eventos, créditos, destinos, inspector); modelo 3D solo en el view dedicado cuando la nave está parada. No copiar specs enteros.

## Risks / Trade-offs

- [Sin catálogo de capas no se ven HH/HV/humedad] → Aceptado: el caso del reto es el hundimiento. Otras capas siguen en el manifiesto para el pipeline.
- [Cultivos sin GLB en el recuadro] → Primitivas del mapa, no un hueco.
- [Probe a 60 Hz] → El recuadro lee `probe` del store (ya se escribe). No suscribir a `flight` en React.
- [Pérdida de créditos/contexto en UI] → Quedan en README/AGENTS; el spec los saca de la HUD.

## Migration Plan

Cambio solo de cliente. No hay datos que migrar. Rollback: revertir el change; el manifiesto no cambia.

## Open Questions

Ninguna que altere los specs: el umbral de reposo 0.5 celdas/s ya existe en escena.
