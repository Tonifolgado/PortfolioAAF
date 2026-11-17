# PortfolioAAF · plan y revisión

Objetivo: convertir el «Panel de Inversión» (artefacto de claude.ai) en una app web independiente, publicable con GitHub Pages, con los datos guardados solo en el navegador.

## Plan

- [x] Sustituir la base de datos de claude.ai por almacenamiento local (`js/store.js`) con la misma interfaz que usa la app (colección, `set`, `update` con mezcla, aviso de cambios).
- [x] Descargas nativas del navegador para la exportación a Excel.
- [x] Copia de seguridad: guardar y restaurar un `.json`, aviso de la última copia y pantalla de bienvenida cuando el navegador no tiene datos.
- [x] Sacar del código cualquier dato personal: el análisis escrito, los avisos por activo y los nombres de los planes pasan a los datos.
- [x] Separar `index.html`, `css/styles.css` y `js/app.js`.
- [x] README con uso, copias de seguridad, GitHub Pages y formato de datos; `.gitignore` que excluye copias y hojas de cálculo.
- [x] Pruebas en navegador (Chromium):
  - pantalla vacía → restaurar copia → cifras iguales que en el panel original (patrimonio 65.031 €, 171 órdenes, 245 cobros);
  - alta de una compra → recargar → se conserva;
  - exportación a Excel y copia de seguridad descargadas;
  - avisos por activo y análisis cargados desde los datos;
  - sin desbordamiento horizontal a 400 px.

## Revisión

- La lógica de cálculo, las tablas, los gráficos y la exportación a Excel no cambian respecto al artefacto. Solo cambia el adaptador de datos (`window.platform`) y los textos que contenían datos personales.
- Limitación conocida: cada navegador y cada dispositivo tienen sus propios datos. Se pasan de uno a otro con la copia de seguridad.
- Siguiente paso posible: sincronización entre dispositivos con un servicio externo, como Supabase o Firebase, si hace falta.

## Iteración 2 · datos en la carpeta del repositorio (17/11/2026)

Decisiones del usuario: mantener el repositorio público con los datos dentro; subir con un botón en la app (supuesto por defecto, git manual sigue disponible).

- [x] `serve.py` (solo librería estándar): sirve la app en 127.0.0.1, `GET/PUT /api/data` sobre `data/portfolio.json` con escritura atómica y JSON ordenado (diffs pequeños), `POST /api/publish` hace commit y push. Solo acepta peticiones de la propia app (Host, Origin y cabecera propia) y no sirve `.git` ni `serve.py`.
- [x] `store.js` con dos modos: archivo (si responde serve.py) o navegador. Guardado automático con espera de 300 ms, reintento si falla y aviso al cerrar con cambios pendientes. Copia en el navegador también en modo archivo.
- [x] Botón «Subir a GitHub» y estado de guardado en la cabecera.
- [x] `abrir.command` para abrir con doble clic en macOS.
- [x] `data/portfolio.json` inicial con los datos del panel.
- [x] Pruebas: peticiones ajenas → 403; `.git` → 404; alta de orden → archivo actualizado; navegador sin datos lee del archivo; publicar → commit en el remoto; publicar sin cambios → aviso; sin servidor → modo navegador.

### Revisión

- Riesgo aceptado por el usuario: los datos financieros quedan públicos en GitHub mientras el repositorio sea público.
- Si dos pestañas editan a la vez, gana el último guardado (se sincronizan entre sí por el almacenamiento del navegador).
