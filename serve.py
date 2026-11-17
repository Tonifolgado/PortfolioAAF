#!/usr/bin/env python3
"""
Servidor local de PortfolioAAF.

Sirve la app en http://localhost:8000 y guarda los datos en data/portfolio.json,
dentro de la carpeta del repositorio, cada vez que cambias algo en la app.
El botón «Subir a GitHub» hace commit y push de ese archivo a la rama actual.

Uso:  python3 serve.py            (puerto 8000)
      python3 serve.py 8080       (otro puerto)

Solo escucha en este ordenador (127.0.0.1). Sin dependencias: Python 3.8+.
"""
import json
import os
import subprocess
import sys
import tempfile
import threading
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "portfolio.json"
FORMAT = "PortfolioAAF"
MAX_BODY = 20 * 1024 * 1024
LOCK = threading.Lock()


def git(*args, timeout=60):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return r.returncode, (r.stdout + r.stderr).strip()


def read_data():
    if not DATA.exists():
        return None
    with DATA.open(encoding="utf-8") as f:
        return json.load(f)


def write_data(payload):
    DATA.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    fd, tmp = tempfile.mkstemp(dir=DATA.parent, prefix=".portfolio-", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, DATA)  # escritura atómica: nunca queda un archivo a medias


def publish():
    rel = str(DATA.relative_to(ROOT))
    code, out = git("rev-parse", "--is-inside-work-tree")
    if code != 0:
        return 500, {"ok": False, "message": "Esta carpeta no es un repositorio git."}
    git("add", rel)
    code, _ = git("diff", "--cached", "--quiet", "--", rel)
    committed = False
    if code != 0:
        msg = "Datos: actualización " + datetime.now().strftime("%d/%m/%Y %H:%M")
        code, out = git("commit", "-m", msg, "--", rel)
        if code != 0:
            return 500, {"ok": False, "message": "No se pudo hacer el commit.", "detail": out}
        committed = True
    code, out = git("push", "origin", "HEAD", timeout=120)
    if code != 0:
        return 502, {"ok": False, "committed": committed,
                     "message": "Commit hecho en local, pero el push a GitHub ha fallado." if committed
                     else "El push a GitHub ha fallado.", "detail": out}
    _, head = git("log", "-1", "--format=%h %s")
    return 200, {"ok": True, "committed": committed,
                 "message": ("Datos subidos a GitHub: " + head) if committed
                 else "No había cambios nuevos que subir; GitHub ya estaba al día."}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # Solo atiende peticiones de la propia app (evita que otra web abierta en
    # tu navegador lea o cambie tus datos).
    def same_origin(self):
        host = self.headers.get("Host", "")
        port = self.server.server_address[1]
        if host not in (f"localhost:{port}", f"127.0.0.1:{port}"):
            return False
        origin = self.headers.get("Origin")
        return origin in (None, f"http://{host}") and self.headers.get("X-PortfolioAAF") == "1"

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/"):
            if not self.same_origin():
                return self.send_json(403, {"message": "Petición no permitida."})
            if self.path == "/api/data":
                with LOCK:
                    try:
                        data = read_data()
                    except (OSError, json.JSONDecodeError) as e:
                        return self.send_json(500, {"message": f"No se pudo leer {DATA.name}: {e}"})
                return self.send_json(200, {"server": True, "file": str(DATA.relative_to(ROOT)), "data": data})
            return self.send_json(404, {"message": "No existe."})
        if self.path.split("?")[0].startswith(("/.git", "/serve.py")):
            return self.send_error(404)
        return super().do_GET()

    def do_PUT(self):
        if self.path != "/api/data" or not self.same_origin():
            return self.send_json(403, {"message": "Petición no permitida."})
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_BODY:
            return self.send_json(413, {"message": "Tamaño de datos no válido."})
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self.send_json(400, {"message": "Los datos recibidos no son JSON válido."})
        if payload.get("format") != FORMAT or not isinstance(payload.get("docs"), dict):
            return self.send_json(400, {"message": "Formato de datos no reconocido."})
        with LOCK:
            try:
                write_data(payload)
            except OSError as e:
                return self.send_json(500, {"message": f"No se pudo escribir {DATA.name}: {e}"})
        return self.send_json(200, {"ok": True})

    def do_POST(self):
        if self.path != "/api/publish" or not self.same_origin():
            return self.send_json(403, {"message": "Petición no permitida."})
        with LOCK:
            try:
                code, result = publish()
            except (OSError, subprocess.TimeoutExpired) as e:
                code, result = 500, {"ok": False, "message": f"No se pudo ejecutar git: {e}"}
        return self.send_json(code, result)


def main():
    nums = [a for a in sys.argv[1:] if a.isdigit()]
    port = int(nums[0]) if nums else 8000
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    except OSError:
        sys.exit(f"El puerto {port} está ocupado. Prueba con: python3 serve.py {port + 1}")
    url = f"http://localhost:{port}/"
    print(f"PortfolioAAF en {url}")
    print(f"Datos: {DATA}")
    print("Para cerrar el servidor, pulsa Ctrl+C.")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor cerrado.")


if __name__ == "__main__":
    main()
