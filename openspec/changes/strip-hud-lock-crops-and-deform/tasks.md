# Tasks

## 1. Escena fija

- [x] 1.1 Poner cultivos en Mexicali con `crops: Boolean(landcover)` independiente de paneles; verificar en `mapModels.test.ts` que hay plantas sin flag de UI
- [x] 1.2 Fijar `deform3d: true` y `deformFactor: 2000` en el store; quitar acciones y factores 5000/10000; verificar en `store.test.ts` el valor inicial
- [x] 1.3 Quitar `agricultureOpen` y `setAgricultureOpen` del store y de `Explorer`; verificar que `bun test` del store y de agriculture sigue en verde

## 2. Recuadro del modelo

- [x] 2.1 Extraer `nearestAnyModel` (cualquier `kind`, radio acotado) y tests en `mapModels.test.ts` para cultivo vs casa más cercana
- [x] 2.2 Crear `ParkedModelView`: GLB si existe, si no primitivas; vacío en vuelo (`hypot < 0.5`) o sin hit; verificar con test de la función de estado (parked/hit → kind) sin montar Three
- [x] 2.3 Montar el recuadro en `Explorer` leyendo `probe` y `mapModels`; verificar que no llama a vuelo ni abre catálogo

## 3. Chrome desnudo y reglas

- [x] 3.1 Quitar de `Explorer` el montaje de `LayerPanel`, `ModelsPanel`, `AgriculturePanel`, eventos, contexto, créditos, `Inspector`, `PoiList`, botones de `TopBar`, `ShipStatus`, `MobileDock` y `SettingsDialog`; dejar timeline + fecha; verificar que no quedan imports muertos (`bunx tsc` o el test de tipos del repo)
- [x] 3.2 Dejar `mapView` en cumulative y que el pick del terreno no abra paneles; verificar con test o grep que no hay `setAgricultureOpen` / `setContextOpen` / `setLayersOpen`
- [x] 3.3 Añadir en `AGENTS.md` la sección Explorer HUD (cultivos on, hundimiento ×2000, sin menús flotantes, modelo solo en el view dedicado al parar) y verificar que el texto está bajo el bloque de Intent

## 4. Integración

- [x] 4.1 Correr la suite de explorer (`bun test src/features/explorer`) y corregir tests que esperen paneles o deform 10000
- [x] 4.2 Verificar en el navegador: Mexicali con plantas, relieve ×2000, sin menús, recuadro al parar la nave y vacío al volar; Tijuana sin cultivos
