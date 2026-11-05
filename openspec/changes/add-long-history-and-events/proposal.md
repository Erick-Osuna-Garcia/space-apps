# Proposal

## Why

NISAR solo tiene datos desde oct-2025, y un año de mediciones con ±2–3 cm de ruido apenas muestra el hundimiento de Cerro Prieto. El usuario pidió más historia, un mapa más grande frente a la nave, solo Mexicali y una lista de eventos de impacto ubicados por zonas.

## What Changes

- **Historia desde 2016** con OPERA DISP-S1 (Sentinel-1), empalmada con NISAR en una sola línea de tiempo. La app indica qué fechas vienen de cada satélite. **Cancelada en los datos publicados:** el código queda como opción, pero `regions.yaml` no la activa y la app usa solo NISAR.
- **Eventos detectados:** hundimiento por zona, cambios de ritmo, agua nueva, cambios bruscos en el terreno y cambios en la superficie, en una lista que lleva a la nave al lugar y la fecha.
- **Mapa ×3 frente a la nave.**
- **BREAKING:** se elimina la región Tijuana.
- **Fuera de alcance:** atribuir causas a los eventos.

## Capabilities

### New Capabilities
- `long-term-history`: serie larga que combina Sentinel-1 y NISAR con su procedencia por fecha.
- `impact-events`: detección y lista de eventos por zona.
- `map-scale`: escala del mapa frente a la nave.

### Modified Capabilities
<!-- Ninguna: las specs previas aún no están archivadas en openspec/specs/. -->

## Impact

- **Pipeline:** `opera.py`, `events.py`, `build.py`, `manifest.py` y `regions.yaml`.
- **Web:** `manifest.ts`, `lib/catalog.ts`, `ui/EventsList.tsx`, escena y `Explorer.tsx`.
- **Cuenta:** requiere aceptar el EULA de la aplicación de ASF para OPERA.
- **Assets:** el cubo de desplazamiento crece con las fechas nuevas.
