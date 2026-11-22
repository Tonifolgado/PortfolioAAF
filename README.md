# PortfolioAAF · Panel de Inversión

Aplicación web personal para seguir una cartera de inversión: acciones y ETF, dividendos, planes de pensiones y fondos. Funciona en cualquier navegador, sin servidor ni instalación.

Los datos se guardan en el archivo **`data/portfolio.json`** de este repositorio cuando abres la app con el servidor local, o en el navegador si la abres sin él. No hay base de datos externa ni cuentas.

> **Aviso:** este repositorio es público y `data/portfolio.json` contiene datos reales de la cartera. Cualquiera puede verlos en GitHub. Para que dejen de ser públicos, cambia la visibilidad del repositorio a privado en *Settings › General › Danger Zone*.

## Qué hace

- **Cabecera**: patrimonio total (inversiones, planes y fondos + cuentas corrientes), total de inversiones, planes y fondos, y recuadros de bolsa, planes y fondos y cuentas corrientes.
- **Resumen**: plusvalía, dividendos y comisiones; gráficos de importe y distribución por tipo de activo, aportación anual, dividendos acumulados, evolución de bolsa frente a planes y peso de cada posición.
- **Patrimonio**: saldos por mes y año de cuentas corrientes, planes de pensiones e inversiones (tablas editables y plegables), tabla de total, distribución del mes elegido y evolución.
- **Posiciones**: agrupadas en ETF, acciones y planes/fondos (plegables), con bróker editable, coste medio, precio de referencia, plusvalía, dividendos y peso; paneles de importe y número de acciones por tipo y por bróker; posiciones cerradas.
- **Compras y ventas**: alta de compras, ventas y gastos con bróker (escribe el ticker o el nombre del activo y el otro se rellena solo; el formulario se vacía al guardar); tabla agrupada por años plegables, con filtros por año, activo y bróker, y totales por bróker que se actualizan con cada orden.
- **Dividendos**: tabla por meses editable y lista de cobros enlazadas (lo que se añade en una aparece en la otra).
- **Análisis**: indicadores calculados con tus datos (fricción por comisiones, coste por bróker) y el análisis escrito guardado en los datos.
- **Simulador de aportación**: frecuencia óptima de compra según la aportación mensual y la comisión por orden.
- **Exportar a Excel**: posiciones, órdenes y dividendos en .xlsx con la estructura de las hojas *Ordenes* y *Dividendo* del Excel original.

La app es la misma que el «Panel de Inversión» publicado en claude.ai, generada a partir de él: cambia solo dónde se guardan los datos.

## Cómo usarla

### En tu ordenador, con los datos en la carpeta (recomendado)

1. En macOS, haz doble clic en **`abrir.command`**. En cualquier sistema también puedes usar el terminal: `python3 serve.py` desde la carpeta del repositorio.
2. Se abre la app en `http://localhost:8000`. Déjala abierta mientras la uses; para cerrarla, pulsa Ctrl+C en la ventana del terminal.
3. Cada cambio se guarda al momento en `data/portfolio.json`. Arriba a la derecha verás «Guardado en data/portfolio.json · hora».
4. Pulsa **Subir a GitHub** para hacer commit y push de ese archivo a la rama actual (`main`). Usa las credenciales de git de tu ordenador. También puedes subirlo tú con `git add data/portfolio.json && git commit -m "Datos" && git push`.

Si el archivo aún no existe y el navegador ya tenía datos, la app los pasa al archivo la primera vez. Si trabajas en otro ordenador, haz `git pull` antes de abrir la app para tener los datos al día.

El servidor solo escucha en tu ordenador (127.0.0.1), solo atiende peticiones de la propia app y no necesita instalar nada: requiere Python 3.8 o superior, que macOS ya trae con las herramientas de desarrollo.

### En el navegador, sin servidor

Si abres la app desde GitHub Pages o con doble clic en `index.html`, funciona igual, pero los datos se guardan en ese navegador y no en el archivo. En ese modo no aparece el botón «Subir a GitHub».

### Copias de seguridad

En modo servidor, `data/portfolio.json` y su historial en git ya son tu copia de seguridad. Además, la app guarda una copia en el navegador. En modo navegador, los datos viven solo en el almacenamiento del navegador (localStorage). Por eso:

- Cada navegador y cada dispositivo tienen sus propios datos. Para pasar de uno a otro, pulsa **Guardar copia** en uno y **Restaurar copia** en el otro.
- Si borras los datos de navegación de ese sitio, se borran también los de la app.
- Guarda una copia con regularidad. La app avisa si nunca has guardado una o si la última tiene más de 30 días.
- El `.gitignore` excluye los archivos de copia descargados (`PortfolioAAF_copia_*.json`), para no subir duplicados de los datos.

Al restaurar una copia se **sustituyen** todos los datos del navegador por los del archivo.

## Publicarla con GitHub Pages

1. En el repositorio, ve a **Settings › Pages**.
2. En *Build and deployment › Source* elige **Deploy from a branch**.
3. Selecciona la rama `main` y la carpeta `/ (root)`, y pulsa **Save**.
4. En uno o dos minutos la app estará en `https://<usuario>.github.io/PortfolioAAF/`.

En esa dirección la app funciona en modo navegador: lo que guardes queda en ese navegador y no cambia `data/portfolio.json`.

## Estructura

```
index.html        estructura de la página
css/styles.css    estilos (tema claro y oscuro)
js/store.js       almacenamiento (archivo o navegador), descargas y copias de seguridad
serve.py          servidor local: sirve la app, guarda data/portfolio.json y publica con git
abrir.command     lanzador para macOS (doble clic)
data/portfolio.json  datos de la cartera
js/app.js         cálculos, tablas, gráficos, formularios y exportación a Excel
tasks/todo.md     plan y revisión del desarrollo
```

Sin compilación ni dependencias que instalar. Usa [Chart.js](https://www.chartjs.org/) 4.4.1 y [SheetJS](https://sheetjs.com/) 0.18.5 desde cdnjs, y las fuentes Bricolage Grotesque e IBM Plex desde Google Fonts. Para usarla sin conexión, descarga esas dos librerías y cambia las rutas en `index.html`.

## Formato de los datos (archivo y copia de seguridad)

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
