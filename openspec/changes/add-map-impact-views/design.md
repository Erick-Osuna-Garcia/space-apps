# Design

## Context

- `add-nisar-isometric-explorer` ya tiene en el cliente el cubo Int16 (T×H×W), el campo de velocidad (`velocityField` en `lib/stats.ts`) y una textura por modo en `scene/layerMaterial.ts` (`uMode`, `uVelocity`, LUT `vik`).
- `ui/PoiLabels.tsx` y `scene/PoiMarkers.tsx` ya resuelven etiquetas DOM proyectadas cada cuadro y faros sobre el terreno, sin roots extra de React.
- El ruido del dato (~0.25 cm por fecha en el sintético, más en el real) vuelve ruidosos los contornos y, sobre todo, el gradiente.
- Motivación y alcance: ver `proposal.md`. Comportamiento: ver `specs/`.

## Goals / Non-Goals

**Goals:**
- Que todo se derive en el cliente del cubo actual, sin cambiar el manifiesto.
- Lógica pura en `lib/impact.ts`, probada con Vitest.

**Non-Goals:**
- Gráficas de estadísticas.
- Evaluar daño o riesgo: las vistas señalan patrones, no consecuencias.
- Contornos vectoriales exportables.

## Decisions

### D1. `mapView` reemplaza a `colorMode`
`store.ts` pasa a `mapView: "cumulative" | "velocity" | "zones" | "differential" | "acceleration"`. El shader usa `uMode` 0–4. **Alternativa:** interruptores combinables, descartada por el usuario para no saturar el mapa.

### D2. Zonas por clasificación en CPU
Por cada fecha: suavizado de caja (radio 2 celdas, ignorando nodata), clasificación en bandas (más alta, sin cambio, baja, media, alta) y componentes conexas por tipo de hundimiento agregado (todo lo que baja más de 2 cm) y por zonas más altas. Se descartan las menores a 1 km². Son ~260 k celdas por fecha, unos pocos ms, y se memoriza por fecha para que la reproducción en bucle no recalcule.

Los cortes son fijos (2, 5, 10 cm) y no relativos, para que una zona "alta" signifique lo mismo en cualquier región y fecha.

### D3. Contornos en el shader a partir de la banda
El resultado se sube como `DataTexture` Uint8 2D con la banda por celda, y se actualiza al cambiar de fecha (~260 KB). El fragment shader pinta el color de la banda y dibuja contorno donde un vecino tiene otra banda. El filtro nearest da un borde escalonado, coherente con el estilo de los parches sin dato. El grosor se calcula con `fwidth` para que mida ~1.5 px a cualquier zoom. **Alternativa:** marching squares a geometría: contornos más suaves, pero más código y hay que reconstruir la malla en cada fecha.

### D4. Marcadores y etiquetas reutilizan el patrón de POIs
`scene/ZoneMarkers.tsx` y `ui/ZoneLabels.tsx` siguen a `PoiMarkers` y `PoiLabels`: faro con `heightAt` y botón DOM proyectado cada cuadro. Solo las 5 zonas de mayor área. El id de cada etiqueta es su posición en ese ranking, para no montar y desmontar botones en cada fecha. El clic fija `flight.target`.

### D5. Diferencial
`differentialField(plane)`: magnitud del gradiente por diferencias centrales sobre el campo suavizado de D2, en cm/km (`cellSizeM`), con nodata si falta un vecino. Se sube como textura float 2D por fecha. Usa una LUT secuencial nueva en `lib/colormap.ts` y el límite `robustLimit`, para que el ruido no aplane la escala. El gradiente amplifica el ruido, por eso nunca se calcula sobre el dato crudo.

### D6. Aceleración
`accelerationField`: velocidad de la segunda mitad menos la de la primera, por píxel, reutilizando la regresión de `velocityField` sobre cada mitad. Se calcula una vez por cubo. Negativo significa que el hundimiento se aceleró, y la LUT divergente ya lo pinta en tono cálido, así que no hace falta invertir el signo. El campo se suaviza porque restar dos pendientes amplifica el ruido. Mínimo 4 fechas.

**Limitación:** con ~1 año de datos, la diferencia entre mitades puede ser estacional (agua subterránea, atmósfera). La ayuda lo dice.

### D7. Sintético con aceleración
El cuenco sintético es lineal, así que la vista Aceleración saldría vacía. Se agrega en `synthetic.py` un término cuadrático pequeño en parte del cuenco y se regeneran los assets. Sigue marcado como `synthetic`.

### D8. Selector compacto
Cinco opciones no caben en una fila de `Segmented` a 288 px: el componente admite una rejilla de 3 columnas. Cada vista lleva su ayuda con `InfoHint`.

### D9. Entrada animada
Los valores iniciales del store pasan a `deform3d: true`, `deformFactor: 10000` y `playing: true`. `Timeline` no avanza hasta que el cubo está listo, para que la animación no arranque a medias. Al cambiar de región se reanuda la reproducción. Costo: `fillForDisplay` ahora corre siempre al cargar (~35 M operaciones, una vez por cubo).

### D10. Título de fecha y ritmo
El título usa Pixelify Sans con sombra dura: evoca un título de juego sin copiar una fuente concreta, e incluye acentos y ñ. `key={date}` reinicia su animación de entrada. Cada fecha dura 3 s y la transición del terreno 2 s, unos 50 s por vuelta con 17 fechas y 1.5 min con 28. NISAR no tiene datos anteriores a oct-2025, así que "más tiempo" se resuelve con el ritmo y no con más historia.

## Risks / Trade-offs

- **[Cortes fijos en otras regiones]** → sirven para Cerro Prieto; una región con cambios mucho menores no mostraría zonas. Se ajustan si se agregan capas.
- **[Falsos patrones en datos reales]** → suavizado, mínimo de 1 km² y aviso de que son patrones en línea de vista.
- **["Más alta" no es necesariamente levantamiento]** → LOS también mezcla movimiento horizontal; la leyenda dice "se acercó al satélite".
- **[Diferencial leído como mapa de daños]** → la leyenda y la ayuda lo aclaran.
- **[Datos sintéticos]** → sigue el aviso permanente; las conclusiones esperan a los datos reales.

## Migration Plan

Sin migración de datos. Se regeneran los assets sintéticos por D7. Rollback = revertir los commits.
