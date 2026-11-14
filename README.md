# Dancing with the SARs · Explorador NISAR

Proyecto para el reto [Dancing with the SARs](https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/) de NASA Space Apps 2026. Es un mapa 3D isométrico del Valle de Mexicali donde pilotas una nave y ves, con datos de radar NISAR, cómo cambia el suelo. El caso central es el hundimiento alrededor del campo geotérmico de Cerro Prieto, en Mexicali.

> **Estado de los datos:** las capas de `public/data` son **mediciones NISAR reales** (productos PROVISIONAL, oct-2025 a oct-2026), más datos de apoyo de Copernicus, ESA WorldCover, WorldPop y OpenStreetMap. Regenerarlas requiere una cuenta de NASA Earthdata: ver [`pipeline/README.md`](pipeline/README.md).

## Cómo correrlo

```bash
bun install
bun run dev      # http://localhost:3000
```

Otros comandos: `bun run build`, `bun run test` y `bun run check`.

## Cómo se usa

- **Pilotar:** `W A S D` o flechas, `Shift` para turbo. Clic o tap en el terreno para volar ahí. Rueda o pellizco para zoom.
- **Destinos:** vuela a un punto de interés.
- **Línea de tiempo:** elige una fecha o presiona play.
- **Cultivos** (solo Valle de Mexicali): abre zonas de la clase Cultivos (ESA WorldCover 2021). Cada zona muestra la humedad NISAR de octubre 2025 a octubre 2026, si la vegetación o la superficie cambiaron, y el canal, río o cuerpo de agua más cercano. Se pueden comparar hasta tres zonas. La cobertura es de 2021 y no dice qué cultivo hay; la humedad es de los primeros centímetros, a unos 200 m. Un cambio de radar no indica su causa, y la cercanía al agua no demuestra riego. No estima cosecha.

## Capas del mapa

Se elige una capa a la vez en el panel de capas, y cada una tiene su ayuda «?». Toca cualquier punto para ver qué dice cada capa de ese lugar.

| Tema | Capas |
|---|---|
| Movimiento | Acumulado, Velocidad, Zonas, Diferencial, Aceleración, Cambios bruscos en el terreno, Vertical y Este-oeste (con flechas) |
| Superficie | Construcciones y suelo (HH), Vegetación (HV), Cambios |
| Agua | Agua en superficie, Humedad del suelo |
| Impacto | Pendiente, Laderas activas, Uso de suelo, Población |

Sobre cualquier capa se pueden encender caminos, canales y, si el dato existe, ríos. El ancho sigue el tipo de vía y los tramos en zonas de cambio se resaltan. La vía de agua que usa la zona agrícola elegida se marca en amarillo. Las vías menores aparecen al acercarse. La nave y las capas de movimiento siguen disponibles.

El agua se anima y reacciona a la nave y al toque. Su extensión viene de las mediciones de cada fecha; el oleaje y las ondas son decorativos y se apagan en Ajustes.

## Eventos de impacto

El botón Eventos lista lo que cambió, agrupado por tipo: zonas de hundimiento, cambios bruscos en el terreno, agua nueva y señal más fuerte. Al tocar un evento, la nave vuela al lugar y el mapa muestra su capa y fecha. Son cambios medidos: no indican su causa ni confirman daños.

**Límites del dato:** hay un año de mediciones, con ±2–3 cm de ruido por fecha aun después de suavizar. El radar mide en línea de vista, así que Acumulado y Velocidad mezclan movimiento vertical y horizontal. Las capas señalan patrones y exposición; no evalúan daños ni riesgo. El «Hundimiento 3D» a ×10,000 es solo ilustrativo.

## Estructura

Qué hace cada función, cómo y por qué: [`docs/funciones.md`](docs/funciones.md).

- `src/features/explorer/`: escena 3D (React Three Fiber), UI y análisis de datos.
- `pipeline/`: pipeline offline en Python que convierte NISAR y el DEM en assets estáticos.
- `public/data/`: assets generados.
- `openspec/`: propuestas, specs y tareas del proyecto.

## Créditos de datos

- NISAR: NASA/JPL-Caltech e ISRO, distribuidos por el ASF DAAC.
- Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
