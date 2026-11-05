# Design

## Context

- `Infrastructure.tsx` usa `LineSegments` con `heightAt`, y reconstruye la geometría en cada fecha. WebGL ignora el grosor de línea, y los tramos saltan mientras el terreno transiciona con `uMix`.
- Datos: 2,137 vías (motorway 105, trunk 458, primary 917, secondary 657) y 565 canales, unos 2,900 tramos en total. La clase ya viene en `Feature.class`.
- Cámara ortográfica; se ven de ~13 a ~770 celdas de ancho, y la vista inicial muestra ~57. El `Canvas` renderiza siempre, así que el tiempo avanza sin `invalidate`.
- `water/cube.bin`: uint8, 13 fechas frente a 28 del desplazamiento. Clases: 0 sin dato, 1 sin agua, 2 permanente (1,417 celdas, ~21 km², constante), 3 nueva (73–478 celdas, y 1,688 en la última fecha).
- Sobre el agua, la capa por defecto no tiene dato y pinta `uNoData` al 85 %: por eso el agua hoy no se ve.

## Goals / Non-Goals

**Goals:** se leen como mapa y como agua sin añadir lag ni descargas.

**Non-Goals:** simulación física del agua, malla de agua aparte, cambiar la detección de agua del pipeline.

## Decisions

### D1. Cintas propias en vez de `Line2`
Una geometría por overlay, construida por función pura en `lib/` con normales de inglete por polilínea (limitadas en curvas cerradas), más un `ShaderMaterial` que expande el ancho en el vértice. `Line2` da ancho en pantalla, pero habría que modificar su shader para el hundimiento, el zoom y el tipo de vía, y helpers de drei ya fallaron aquí con `Trail` y `Html`.

### D2. Ancho en celdas con mínimo en píxeles
`ancho = max(anchoClase, píxelesMínimos × unidadesPorPíxel)`. `Infrastructure` lee el zoom de la cámara en su `useFrame`. El borde es un segundo draw más ancho con la misma geometría y `renderOrder` menor.

### D3. Hundimiento en el vértice
Las cintas guardan solo la altura base y comparten por referencia `uDeformCube`, `uDateA/B`, `uMix` y `uDeform` con el terreno, así que se mueven con él y no se reconstruyen por fecha. Hace falta una función de altura base aparte de `heightAt`, que ya incluye el hundimiento. Cada tramo se subdivide cada celda para que siga el relieve.

### D4. Zoom y tramos afectados por atributo
Cada vértice lleva el nivel de su clase y el índice de su tramo. El desvanecido se resuelve en el shader, sin reconstruir. Umbrales iniciales en celdas visibles: primarias y canales bajo 400, secundarias bajo 200; se ajustan viendo el mapa. El atributo de color y "afectado" se actualiza solo cuando cambian los `flags`, y un tramo afectado ignora el desvanecido.

### D5. Agua dentro del shader del terreno
Se extiende `createTerrainMaterial`: el agua sigue la deformación sin coordinar otra malla, no añade raycast y no tiene problemas de orden con el terreno. La alternativa de una malla translúcida aparte duplicaría deformación y bordes.

### D6. Textura de máscara
En el cliente, una función pura convierte el cubo en una `DataArrayTexture` RG8 (R permanente, G nueva), con caja 3×3 por fecha y filtro lineal. Un `smoothstep` alrededor de 0.5 suaviza bordes, y una celda aislada (1/9) queda bajo el umbral, sin análisis de componentes. Sin dato cuenta como sin agua.

### D7. Fechas de agua
Una función pura da el índice de agua de cada fecha del timeline: la última medición `<=` a esa fecha. `uWaterA/B` y `uWaterMix` transicionan igual que `uDateA/B`.

### D8. Prioridad frente a la capa
El agua se aplica después de pintar la capa, solo donde la capa está apagada, sin dato, o en banda "sin pintar". Con dato, la capa prevalece.

**Trade-off:** en capas que cubren todo el mapa, como Población, el agua no se ve animada. Se prefiere no ocultar datos.

### D9. Oleaje y ondas
- Oleaje: dos ondas procedurales en coordenadas de grilla que perturban la normal en `normal_fragment_maps`, con rugosidad baja en `roughnessmap_fragment`, usando `uTime`.
- Ondas: hasta 8 en un uniform `vec3[8]` (col, fila, nacimiento) como anillo circular, con vida de ~2.5 s.
- La nave genera una cada ~0.35 s si se mueve sobre agua; la lectura usa la máscara en CPU por una función pura.
- `IsoCamera` agrega una onda en el clic que ya resuelve `pickTerrain`. No se agregan handlers R3F al terreno.

### D10. Agua nueva
Tono más claro y mezcla parcial con el terreno. Se dibuja también la última fecha, aunque su salto (1,688 celdas) sea dudoso: no se ocultan mediciones, y el aspecto traslúcido y la aclaración de Ajustes evitan presentarla como confirmada.

### D11. Ajuste
`waterMotion` en el store, activo por defecto. Apagado o con `reducedMotion`, `uTime` se congela y no nacen ondas. Canales: su cinta usa el mismo `uTime` para un brillo que avanza a lo largo de la vía.

## Risks / Trade-offs

- **[Lagos inclinados con ×10,000]** el cubo de deformación tiene huecos rellenados, así que el agua se deforma con el terreno → revisarlo en pantalla; si molesta, atenuar la deformación con la máscara.
- **[Costo del fragment shader]** más muestreos por píxel → todo se evalúa solo si la máscara es mayor que 0; probar con zoom.
- **[Parpadeo entre cinta y terreno]** a ras del suelo → elevación pequeña y `polygonOffset`.
- **[Canales más anchos que en la realidad]** el ancho mínimo exagera → es una decisión de legibilidad; el mapa es ilustrativo.
- **[Orilla en cuadros con una capa encendida]** la capa pinta por celda y gana donde tiene dato, así que recorta el agua en cuadros; sin capa la orilla es suave → se acepta para no ocultar datos.
- **[+3.4 MB al inicio]** → carga en segundo plano, y el cubo se comparte con la capa de agua por la misma query.

## Migration Plan

Solo código de la web, sin migrar datos. Rollback = revertir commits.
