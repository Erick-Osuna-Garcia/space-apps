# Dancing with the SARs · Explorador NISAR

Proyecto para el reto [Dancing with the SARs](https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/) de NASA Space Apps 2026. Es un mapa 3D isométrico de Baja California donde pilotas una nave y ves, con datos de radar NISAR, cómo cambia el suelo. El caso central es el hundimiento alrededor del campo geotérmico de Cerro Prieto, en Mexicali.

> **Estado de los datos:** la capa incluida en `public/data` es **sintética**, de desarrollo, y la app lo avisa en pantalla. Para generar la capa real se necesita una cuenta de NASA Earthdata: ver [`pipeline/README.md`](pipeline/README.md).

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

## Vistas del mapa

Se elige una a la vez en el panel de capas. Cada una tiene su ayuda «?».

| Vista | Qué muestra |
|---|---|
| Acumulado | Cuánto se movió el suelo desde la primera fecha, en cm |
| Velocidad | Qué tan rápido se mueve cada punto, en cm/año |
| Zonas | Áreas más bajas o más altas que al inicio, con contorno, punto extremo y velocidad media |
| Diferencial | Dónde el terreno se dobla porque un lado baja más que el otro, en cm/km |
| Aceleración | Dónde el hundimiento se acelera o se frena |

El radar mide en línea de vista, así que los valores mezclan movimiento vertical y horizontal. Las vistas señalan patrones; no evalúan daños ni riesgo. Al entrar, el mapa arranca solo: la línea de tiempo se reproduce y el terreno se hunde con «Hundimiento 3D» a ×10,000. Esa exageración es solo ilustrativa, y se puede pausar o apagar.

## Estructura

- `src/features/explorer/`: escena 3D (React Three Fiber), UI y análisis de datos.
- `pipeline/`: pipeline offline en Python que convierte NISAR y el DEM en assets estáticos.
- `public/data/`: assets generados.
- `openspec/`: propuestas, specs y tareas del proyecto.

## Créditos de datos

- NISAR: NASA/JPL-Caltech e ISRO, distribuidos por el ASF DAAC.
- Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
