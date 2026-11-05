# Tasks

## 1. Mapa y región

- [x] 1.1 Eliminar Tijuana de configuración, datos, tests y textos; verificar con pytest y Vitest
- [x] 1.2 Aplicar `MAP_SCALE` a nave, velocidad, cámara y marcadores; verificar con tests de vuelo y TypeScript

## 2. Historia

- [x] 2.1 Implementar `opera.py` (selección, lectura, encadenado, empalme y comparación); verificar con pytest
- [x] 2.2 Declarar tramos de fuente en el manifiesto y mostrarlos en la UI; verificar con Vitest

Cancelado por el usuario: la serie larga no se generó porque las descargas de OPERA se colgaban y los datos pesarían más. `opera.py` queda como opción sin usar, sin `history` en `regions.yaml`, y la exageración por defecto no cambia.

## 3. Eventos

- [x] 3.1 Implementar `events.py` y su integración; verificar con pytest
- [x] 3.2 Implementar el botón y la lista de eventos; verificar con Vitest y TypeScript
- [x] 3.3 Generar `events.json` con datos reales y revisar que los eventos sean coherentes; verificar leyendo la lista

## 4. Cierre

- [x] 4.1 Actualizar README y pipeline/README; verificar que describen los eventos, solo NISAR, y sus límites
- [x] 4.2 Correr `bun run test`, `bunx tsc --noEmit`, `bunx biome check src/features`, `uv run pytest` y `bun run build`; verificar que pasan
