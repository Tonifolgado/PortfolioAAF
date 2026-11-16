# PortfolioAAF · Panel de Inversión

Aplicación web personal para seguir una cartera de inversión: acciones y ETF, dividendos, planes de pensiones y fondos. Funciona en cualquier navegador, sin servidor ni instalación.

**Tus datos no salen de tu navegador.** No hay base de datos externa, ni cuentas, ni envío de información. Este repositorio solo contiene el código: ninguna orden, importe ni posición.

## Qué hace

- **Resumen**: patrimonio total, invertido en bolsa, planes y fondos, plusvalía, dividendos y comisiones. Gráficos de aportación anual, dividendos acumulados, evolución de bolsa frente a planes y peso de cada posición.
- **Posiciones**: agrupadas en ETF, acciones y planes/fondos (plegables), con coste medio, precio de referencia editable, plusvalía, dividendos y peso.
- **Compras y ventas**: alta de compras, ventas y gastos (custodia, comisiones), con filtros por año y activo y totales.
- **Dividendos**: tabla por meses editable como una hoja de cálculo y lista de cobros con fecha, ticker e importe corregibles.
- **Análisis**: indicadores calculados con tus datos (fricción por comisiones, coste por bróker) y, si lo incluyes en tu copia, un análisis escrito.
- **Simulador de aportación**: frecuencia óptima de compra según la aportación mensual y la comisión por orden, con proyección a largo plazo.
- **Exportar a Excel**: posiciones, órdenes y dividendos en .xlsx con la estructura de las hojas *Ordenes* y *Dividendo* del Excel original. Cada archivo explica cómo pegarlo.

## Cómo usarla

1. Abre la app: la dirección de GitHub Pages (ver abajo) o el archivo `index.html` descargado en tu ordenador.
2. La primera vez, pulsa **Restaurar copia de seguridad** y elige tu archivo `PortfolioAAF_copia_AAAA-MM-DD.json`. Si empiezas de cero, registra tu primera compra.
3. Todo lo que añadas o corrijas se guarda al momento en ese navegador.

### Copias de seguridad

Los datos viven en el almacenamiento del navegador (localStorage). Por eso:

- Cada navegador y cada dispositivo tienen sus propios datos. Para pasar de uno a otro, pulsa **Guardar copia** en uno y **Restaurar copia** en el otro.
- Si borras los datos de navegación de ese sitio, se borran también los de la app.
- Guarda una copia con regularidad. La app avisa si nunca has guardado una o si la última tiene más de 30 días.
- **No subas tus copias a este repositorio.** El `.gitignore` ya excluye los archivos de copia.

Al restaurar una copia se **sustituyen** todos los datos del navegador por los del archivo.

## Publicarla con GitHub Pages

1. En el repositorio, ve a **Settings › Pages**.
2. En *Build and deployment › Source* elige **Deploy from a branch**.
3. Selecciona la rama `main` y la carpeta `/ (root)`, y pulsa **Save**.
4. En uno o dos minutos la app estará en `https://<usuario>.github.io/PortfolioAAF/`.

Los datos que guardes en esa dirección quedan en tu navegador, no en GitHub.

## Estructura

```
index.html        estructura de la página
css/styles.css    estilos (tema claro y oscuro)
js/store.js       almacenamiento local, descargas y copias de seguridad
js/app.js         cálculos, tablas, gráficos, formularios y exportación a Excel
tasks/todo.md     plan y revisión del desarrollo
```

Sin compilación ni dependencias que instalar. Usa [Chart.js](https://www.chartjs.org/) 4.4.1 y [SheetJS](https://sheetjs.com/) 0.18.5 desde cdnjs, y las fuentes Bricolage Grotesque e IBM Plex desde Google Fonts. Para usarla sin conexión, descarga esas dos librerías y cambia las rutas en `index.html`.

## Formato de la copia de seguridad

```json
{
  "format": "PortfolioAAF",
  "version": 1,
  "exportedAt": "2026-11-16T19:00:00Z",
  "docs": {
    "orders-2026": { "rows": [{ "id": "…", "date": "2026-10-01", "type": "buy", "ticker": "…", "qty": 10, "price": 100.0, "fee": 1.0 }] },
    "divs-2026":   { "rows": [{ "id": "…", "date": "2026-09-15", "ticker": "…", "amount": 12.5 }] },
    "meta":        { "catalog": { "<ticker>": { "name": "…", "kind": "ETF", "broker": "…", "isin": "…" } }, "prices": {} },
    "plans":       { "plans": { "<id>": { "name": "…", "units": 0, "nav": 0, "contributed": null } }, "snapshots": [] },
    "analysis":    { "summary": "…", "html": "…", "note": "…" }
  }
}
```

`type` puede ser `buy` (compra), `sell` (venta) o `fee` (gasto). El documento `analysis` es opcional.

## Aviso

Herramienta personal de seguimiento. No es asesoramiento financiero ni fiscal.
