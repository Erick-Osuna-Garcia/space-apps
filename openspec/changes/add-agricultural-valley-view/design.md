# Design

## Context

La región `mexicali` ya está en el manifiesto: grilla 512×511, celdas de ~121 m, cobertura ESA WorldCover 2021 (clase `5` = Cultivos), humedad SME2 en m³/m³ (`scale` 0.001, ~200 m), HV y cambios GCOV, disturbios, agua y overlays `roads` y `canals`. La consulta OSM solo pide `waterway=canal`. Las zonas de hundimiento viven en `lib/impact.ts` y no describen cultivos. Ver `proposal.md` y los specs de este cambio.

## Goals / Non-Goals

**Goals:**
- Derivar las zonas y sus series en el cliente, con lógica pura y tests, sin volver a procesar NISAR.
- Separar esta selección de las zonas de hundimiento y de la capa activa del mapa.
- Cargar los cubos que la ficha necesita solo cuando el panel agrícola está abierto.

**Non-Goals:**
- Cambiar la capa con la que abre el explorador.
- Nombrar predios, localidades o cultivos que no vengan en los datos.
- Un modelo de riego, de caudal o de vecindad hidrológica.

## Decisions

### D1. Bloques de cultivo, partidos si son enormes
Una zona es un componente 4-conexo de celdas Cultivos (`5`). Las celdas que cruza un canal o un río no unen componentes: separan bloques, no se borran del mapa de cobertura. Se descarta lo que mida menos de 1 km². Si un componente pasa de 25 km², se corta con una retícula de 16×16 celdas (~2 km) y cada pieza vuelve a exigir 1 km² de cultivo. La ayuda dice ese corte y el mínimo.

**Alternativa:** solo componentes, sin corte. El distrito de riego puede quedar en un solo bloque y la comparación no tiene con qué trabajar. **Alternativa:** retícula fija en todo el valle. Produce cientos de cuadros parecidos y deja de ser «un parche de cultivo».

El id es el índice tras ordenar por área descendente y, a igualdad, por la celda menor. Así no cambia entre fechas.

### D2. La lista es un cupo; el clic llega a todas
La lista muestra las 12 zonas de mayor área y, si hay más, lo dice. Cualquier zona que supere el mínimo se elige al tocar una de sus celdas, aunque no esté en esas 12. Tocar una celda que no es Cultivos, o un parche bajo el mínimo, no selecciona zona agrícola. El contorno se dibuja solo para la zona elegida (máscara Uint8 y borde donde un vecino no pertenece), no para las 12.

**Alternativa:** no dejar elegir lo que no está en la lista. Escondería casi todo el valle si el corte de D1 deja muchos bloques.

Elegir una zona lleva la nave a su centroide con el mismo destino de vuelo que los puntos de interés. No cambia `mapView`.

### D3. Series calculadas una vez por zona
Al abrir el panel se piden, con las queries que ya existen, `landcover`, `moisture`, `hv`, `change`, `disturbance` y `water`. Con los índices de cada zona se calcula una sola vez:

- Humedad: media de las celdas con dato en cada fecha, en m³/m³. Si no hay ninguna, la fecha queda sin lectura; no se guarda 0.
- Vegetación: media HV en dB. Frente a la primera fecha, «más intensa» o «más débil» solo si la diferencia pasa de 3 dB (el mismo umbral que ya usa la capa de cambios); si no, «parecida».
- Cambios: se cuenta la clase 2 (señal más fuerte) y la 3 (señal más débil). Se nombra la mayor solo si cubre al menos el 10 % de las celdas con dato; si no, no hay cambio dominante.
- Disturbio: hay disturbio si la clase 2 cubre al menos el 10 % de las celdas con dato.

Esos textos no nombran cultivo, causa ni riego. La ficha siempre añade las tres aclaraciones del spec de condiciones (cobertura 2021, sin tipo de cultivo, sin cosecha ni consejo de riego) y la de humedad (primeros centímetros, ~200 m).

### D4. Comparar incluye a la zona elegida
La comparación muestra como máximo tres series de humedad, alineadas por la unión de fechas. La zona elegida ocupa un lugar. Agregar otra suma si aún hay cupo; la cuarta no entra y la ayuda dice el límite de tres. Quitar una de la comparación no cierra la ficha.

### D5. Agua por distancia al bloque, no al centroide
La vía más cercana es el tramo de canal o río cuya distancia mínima a cualquier celda de la zona sea la menor, dentro de 2 km. Si tiene nombre se muestra; si no, «sin nombre», con el tipo (canal o río) y la distancia. Fuera de 2 km no hay vía cercana. El agua permanente (clase 2) o nueva (clase 3) cuenta si cae en la zona o en el anillo de una celda, en la fecha activa. La vía usada se dibuja con el mismo listón que los canales, en otro color, solo mientras la zona sigue elegida. El texto dice que la cercanía no demuestra riego ni suministro.

### D6. Ríos como overlay nuevo, opcional
`overpass_query` también pide `way["waterway"="river"]`. `osm_to_grid` los separa de los canales. El manifiesto gana `kind: "river"` en el enum de overlay, sin subir `schemaVersion`: un manifiesto sin ríos sigue siendo válido. Se escribe `mexicali/rivers.json` solo si la consulta OSM responde. Si no está, la ficha usa canales y la capa de agua y no menciona un río. Las vías se dibujan como los canales, con color propio.

**Alternativa:** meter los ríos en `canals.json`. Rompe el tipo único de ese archivo y obliga a adivinar cuáles eran ríos.

### D7. Dónde vive en la UI
Panel nuevo, hermano del inspector de punto. El inspector sigue diciendo qué hay en la celda. El estado nuevo del store es el id de zona agrícola y los ids comparados; no reutiliza la selección de hundimiento. La ayuda usa el mismo patrón «?» de los otros paneles. Solo se ofrece con la región `mexicali`.

## Risks / Trade-offs

- [WorldCover 2021 no es la temporada NISAR] → La ficha lo dice en cada zona; no se anima una cobertura que no tenemos.
- [La humedad está a ~200 m y la grilla a ~121 m] → La media repite valores vecinos. Se muestra la resolución en lugar de interpolar un dato más fino.
- [Un canal OSM mal trazado parte un bloque de más] → El clic sigue eligiendo cada pieza y el mínimo de 1 km² tira las astillas.
- [Overpass puede fallar o no traer el Río Colorado como `river`] → Los canales y el agua medida bastan; no se inventa el río.
- [Varios cubos a la vez] → Se cargan al abrir el panel, no al entrar al explorador. Las series no se recalculan en cada cuadro.

## Migration Plan

No hay migración de cubos NISAR. El enum `river` es aditivo. Si el overlay no se genera, la app actual sigue igual y la ficha agrícola cae en el caso «sin ríos». Quitar el panel y el estado nuevo revierte la función sin tocar los assets previos.

## Open Questions

Ninguna. Los umbrales de esta sección (1 km², 25 km², 12 zonas, 3 comparadas, 2 km, 3 dB, 10 %) quedan fijos para que los specs que hablan de «la ayuda» tengan un solo número que mostrar.
