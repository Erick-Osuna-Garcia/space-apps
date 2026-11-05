# Tasks

## 1. Cintas de caminos y canales

- [x] 1.1 Crear en `lib/` la construcción de cintas (subdivisión, normales de inglete con límite, atributos de clase y tramo); verificar con Vitest curvas, polilíneas de 2 puntos y puntos repetidos
- [x] 1.2 Exponer la altura base del terreno sin hundimiento y pasarla a `Infrastructure`; verificar con TypeScript y un test de que no incluye la deformación
- [x] 1.3 Reemplazar `LineSegments` por el material de cinta con borde, ancho mínimo en píxeles y uniforms compartidos del hundimiento; verificar con `tsc` y que el raycast de la cinta está desactivado
- [x] 1.4 Leer de la cámara, en `Infrastructure`, las unidades por píxel y las celdas visibles, y aplicar el desvanecido por clase; verificar con un test puro de visibilidad por clase y zoom, tramos afectados incluidos
- [x] 1.5 Actualizar solo el atributo de resaltado cuando cambian los `flags`; verificar con Vitest que `affectedSegments` y el índice de tramo coinciden tras subdividir

## 2. Máscara de agua

- [x] 2.1 Crear en `lib/` la máscara por fecha (permanente, nueva, caja 3×3) y su lectura en un punto; verificar con Vitest que una celda aislada queda bajo el umbral y que sin dato no cuenta como agua
- [x] 2.2 Crear el mapeo de fechas del timeline a fechas de agua; verificar con Vitest fechas exactas, intermedias y anteriores a la primera medición
- [x] 2.3 Cargar el cubo de agua en segundo plano reutilizando su query; verificar que el mapa funciona si falla, con la query forzada a error en un test o en el navegador

## 3. Superficie de agua

- [x] 3.1 Agregar la máscara y uniforms a `createTerrainMaterial`, con oleaje, brillo y prioridad frente a la capa, y subir la clave de caché del programa; verificar compilando el shader en el navegador sin errores de consola
- [x] 3.2 Transicionar la extensión con la fecha y diferenciar el agua nueva; verificar en el navegador avanzando el timeline
- [x] 3.3 Aplicar el brillo que avanza en las cintas de canal; verificar en el navegador

## 4. Interacción y ajustes

- [x] 4.1 Crear el anillo de ondas como lógica pura y conectarlo a la nave; verificar con Vitest que nacen solo en movimiento sobre agua y que el anillo reemplaza la más vieja
- [x] 4.2 Agregar la onda al tocar el agua desde el clic existente de `IsoCamera`; verificar que la nave sigue volando al punto y que no hay handlers nuevos en el terreno
- [x] 4.3 Agregar `waterMotion` al store y el interruptor con la aclaración a `SettingsDialog`, respetando `reducedMotion`; verificar con tests del store
- [x] 4.4 Documentar en el README los caminos, el agua animada y la diferencia entre lo medido y lo decorativo; verificar leyendo la sección

## 5. Integración

- [x] 5.1 Revisar en el navegador el zoom sin lag, las vías junto al terreno con hundimiento 3D, y los lagos a ×10,000; verificar sin errores de consola, ajustando umbrales si hace falta
- [x] 5.2 Correr `bun run test`, `bunx tsc --noEmit -p .`, `bunx biome check src/features` y `bun run build`; verificar que pasan
