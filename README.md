# Dancing with the SARs · Explorador NISAR

Proyecto para el reto [Dancing with the SARs](https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/) de NASA Space Apps 2026. Es un mapa 3D isométrico de Baja California donde pilotas una nave y ves, con datos de radar NISAR, cómo cambia el suelo. El caso central es el hundimiento alrededor del campo geotérmico de Cerro Prieto, en Mexicali.

> **Estado de los datos:** las capas de `public/data` son **mediciones NISAR reales** (productos PROVISIONAL, oct-2025 a oct-2026), más datos de apoyo de Copernicus, ESA WorldCover, WorldPop y OpenStreetMap. Regenerarlas requiere una cuenta de NASA Earthdata: ver [`pipeline/README.md`](pipeline/README.md).

## Cómo correrlo

```bash
bun install
bun run dev      # http://localhost:3000
```

Otros comandos: `bun run build`, `bun run test` y `bun run check`.

## Cómo se usa

- **Pilotar:** `W A S D` o flechas, `Shift` para turbo. Clic o tap en el terreno para volar ahí. Rueda o pellizco para zoom.
- **Destinos:** vuela a un punto de interés o salta a otra región con warp.
- **Línea de tiempo:** elige una fecha o presiona play.

## Capas del mapa

Se elige una capa a la vez en el panel de capas, y cada una tiene su ayuda «?». Toca cualquier punto para ver qué dice cada capa de ese lugar.

| Tema | Capas |
|---|---|
| Movimiento | Acumulado, Velocidad, Zonas, Diferencial, Aceleración, Disturbios, Vertical y Este-oeste (con flechas) |
| Superficie | Construcciones y suelo (HH), Vegetación (HV), Cambios |
| Agua | Agua en superficie, Humedad del suelo |
| Impacto | Pendiente, Laderas activas, Uso de suelo, Población |

Sobre cualquier capa se pueden encender caminos y canales, con los tramos en zonas de cambio resaltados.

**Límites del dato:** hay un año de mediciones, con ±2–3 cm de ruido por fecha aun después de suavizar. El radar mide en línea de vista, así que Acumulado y Velocidad mezclan movimiento vertical y horizontal. Las capas señalan patrones y exposición; no evalúan daños ni riesgo. El «Hundimiento 3D» a ×10,000 es solo ilustrativo.

## Estructura

- `src/features/explorer/`: escena 3D (React Three Fiber), UI y análisis de datos.
- `pipeline/`: pipeline offline en Python que convierte NISAR y el DEM en assets estáticos.
- `public/data/`: assets generados.
- `openspec/`: propuestas, specs y tareas del proyecto.

## Créditos de datos

- NISAR: NASA/JPL-Caltech e ISRO, distribuidos por el ASF DAAC.
- Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
