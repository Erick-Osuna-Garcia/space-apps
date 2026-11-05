# Design

## Context

- Frame OPERA **F46291**: descendente como el stack NISAR 85/72, 100 % de la región, 374 fechas de 2016-07 a 2026-04, 25 fechas de referencia.
- Los productos están en UTM 11N a 30 m, con `displacement` en metros (positivo hacia el satélite, igual que nuestra convención) y `recommended_mask`.
- Motivación: `proposal.md`.

## Goals / Non-Goals

**Goals:** una sola línea de tiempo con procedencia visible.

**Non-Goals:** corregir las diferencias de geometría entre satélites; atribuir causas.

## Decisions

### D1. Fechas seleccionadas
Se leen los eslabones entre grupos de referencia y una fecha cada 75 días como mínimo, para limitar lecturas y tamaño.

### D2. Encadenado con la inversión existente
Cada producto es un par (referencia → fecha), así que se reutilizan `fill_network_gaps` e `invert_network`. Se aplica la misma referencia y eliminación de rampa que a NISAR.

### D3. Empalme por píxel
Hasta la fecha inicial de NISAR se usa Sentinel-1; desde ahí, ese valor más la serie NISAR. El rechazo de atípicos usa umbrales mayores en la historia porque acumula más años.

**Trade-off:** ambos satélites son descendentes pero con distinta banda e incidencia, así que el empalme es aproximado.

### D4. Velocidad de NISAR separada
La descomposición vertical/este-oeste sigue usando la velocidad NISAR, no la serie combinada, para no mezclar periodos.

### D5. Eventos en el pipeline
Se calculan una vez y se guardan en `events.json`. Una zona de una capa categórica cuenta una vez aunque aparezca en varias fechas.

### D6. Escala con `MAP_SCALE`
En vez de escalar la malla, se reducen la nave, su velocidad y los marcadores, y la cámara se acerca en la misma proporción. El resultado es idéntico sin tocar coordenadas ni datos.

### D7. Eventos solo con NISAR
Se canceló la serie larga, así que los eventos salen del año de NISAR. Con ese ruido, el hundimiento se detecta sobre el acumulado final suavizado (ventana de 9×9 celdas) con umbral de 3 cm, para agrupar zonas continuas y no parcelas sueltas. El máximo se lee del campo suavizado; la velocidad y la serie, solo de las celdas que bajaron. Los cambios de ritmo necesitan 365 días a cada lado, así que hoy no aparecen.

## Risks / Trade-offs

- **[Empalme entre satélites]** → se mide la correlación en el periodo común y se reporta.
- **[Conexiones colgadas al descargar]** → la caché permite reanudar.
- **[Celdas visibles al acercarse]** → las celdas de 121 m se notan como cuadros.

## Migration Plan

Regenerar los assets. Rollback = revertir commits y assets.
