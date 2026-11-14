# Tasks

## 1. Zonas de cultivo

- [x] 1.1 Crear en `src/features/explorer/lib/` el armado de zonas: clase Cultivos `5`, 4-conexas, barreras donde pasa un canal o un río, descarte bajo 1 km², corte a 16×16 celdas si un bloque pasa de 25 km², e ids estables por área y celda menor. Verificar con Vitest un parche chico excluido, una barrera que parte dos bloques, un bloque grande cortado y el orden estable
- [x] 1.2 Separar la lista de 12 zonas mayores del resto, sin dejar de resolver el toque sobre cualquier zona válida. Verificar con Vitest que el cupo avisa si omite zonas, que una celda de una zona fuera de la lista sí resuelve, y que cultivo bajo el mínimo o una celda que no es cultivo no selecciona zona
- [x] 1.3 Exponer centroide, área en km² y máscara de contorno de la zona elegida. Verificar con Vitest el centroide y que el borde marca solo donde un vecino no pertenece a la zona

## 2. Lectura temporal

- [x] 2.1 Calcular la humedad media por fecha en m³/m³, dejando la fecha vacía si no hay celdas con dato. Verificar con Vitest que el nodata no entra como cero y que la media usa `scale`
- [x] 2.2 Resumir HV, cambios y disturbios de la fecha: ±3 dB contra la primera fecha, clases 2 y 3 de cambios, clase 2 de disturbio, y solo si cubren al menos el 10 %. Verificar con Vitest «más intensa», «más débil», «parecida», sin cambio dominante, con disturbio y con una capa ausente
- [x] 2.3 Limitar la comparación a tres series, contando la zona elegida, alineadas por fecha. Verificar con Vitest que la cuarta se rechaza y que las fechas quedan alineadas
- [x] 2.4 Centralizar los textos de ayuda con los umbrales de `design.md` y las tres aclaraciones (cobertura 2021, sin tipo de cultivo, sin cosecha ni riego) más la de humedad (primeros centímetros, ~200 m). Verificar con Vitest que esos textos están y que ninguno recomienda regar ni nombra una causa

## 3. Contexto hídrico

- [x] 3.1 Elegir la vía más cercana a cualquier celda de la zona, hasta 2 km, conservando tipo, nombre y distancia. Verificar con Vitest canal con nombre, río sin nombre, vía fuera de 2 km y ausencia de ríos sin inventar uno
- [x] 3.2 Detectar agua permanente (clase 2) y agua nueva (clase 3) dentro de la zona o en el anillo de una celda, por fecha. Verificar con Vitest agua nueva junto a la zona, agua permanente dentro, y ninguna en esa fecha
- [x] 3.3 Añadir la aclaración de que la cercanía no demuestra riego ni suministro, y el texto de «no hay vía cercana» sin hablar de derechos de agua. Verificar con Vitest que la ficha incluye esa aclaración cuando hay vía o cuerpo de agua

## 4. Ríos en el overlay

- [x] 4.1 Pedir `waterway=river` en la consulta OSM y guardarlos aparte de los canales. Verificar con pytest que un río no entra a `canal` y que un canal sigue en `canal`
- [x] 4.2 Aceptar `kind: "river"` en el manifiesto de Python y en el esquema de `manifest.ts`, sin subir `schemaVersion`. Verificar que el manifiesto de ejemplo sigue parseando y que un overlay río también parsea
- [x] 4.3 Dibujar los ríos con el listón de los canales y un color distinto, y resaltar solo la vía que usa la zona elegida. Verificar con un test puro de qué tramo queda resaltado y que, sin `rivers.json`, canales y agua siguen disponibles
- [x] 4.4 Documentar el overlay de ríos en `pipeline/README.md`. Verificar que esa sección dice que es opcional y que no hace falta reprocesar NISAR

## 5. Panel y escena

- [x] 5.1 Añadir al store la zona agrícola elegida y las comparadas, sin tocar la selección de hundimiento ni el `mapView` inicial. Verificar con un test del store que elegir una zona agrícola no cambia la vista de movimiento
- [x] 5.2 Abrir un panel de agricultura solo en `mexicali`, cargar `landcover`, `moisture`, `hv`, `change`, `disturbance` y `water` con las queries existentes, y mostrar lista, ficha y series. Verificar en el navegador que sin cobertura la lista explica que falta, y que cambiar la fecha mueve la media y el resalte
- [x] 5.3 Al elegir una zona, volar al centroide, dibujar su contorno y no el de las demás. Verificar en el navegador el vuelo y el contorno, y que las zonas de hundimiento siguen en su propia lista
- [x] 5.4 Conectar el toque del terreno a la resolución de zona y el resalte de la vía. Verificar en el navegador que un toque en cultivo elige la zona, que un toque fuera no la elige, y que la vía usada se distingue
- [x] 5.5 Documentar en el README la lectura agrícola, sus fechas y sus límites, sin quitar el uso de la nave ni las capas de movimiento. Verificar leyendo esa sección

## 6. Integración

- [x] 6.1 Recorrer en el navegador la lista, una comparación de tres zonas, el rechazo de la cuarta, el timeline y una zona sin humedad en alguna fecha. Verificar que no hay errores de consola y que la capa con la que abre el mapa no cambió
- [ ] 6.2 Correr `bun run test`, `bun run check` y, en `pipeline/`, `uv run pytest`. Verificar que pasan

## Workflow follow-up

- Implementar solo cuando se pida aplicar este cambio.
- Archivar después de que la implementación cumpla los specs.
