"""Local control panel for the Shopee scraper -- a small Flask server you
run on your own PC (never deployed to Vercel; Chrome automation can't run
there). Gives you Start/Pause/Stop buttons instead of the CLI, and inserts
scraped products directly into the live database via the site's admin API.

Usage:
    python panel_app.py
    (then open http://localhost:5000 in your browser)
"""
import csv
import io
import logging
import os
import threading

import requests
from flask import Flask, jsonify, request, send_from_directory

import site_client
from build_payload import build_api_payload
from scrape import ScrapeControl, build_driver, run_scrape_loop

log = logging.getLogger("panel")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

app = Flask(__name__, static_folder="static", static_url_path="")

LINK_COLUMN_GUESS = "Link Produk"
MAX_LOG_LINES = 300

_lock = threading.Lock()
_driver = None
_control: ScrapeControl | None = None
_csv_rows: list[dict] | None = None
_csv_headers: list[str] | None = None

_state = {
    "status": "idle",  # idle | browser_ready | running | paused | stopped | done | error
    "total": 0,
    "current": 0,
    "success": 0,
    "failed": 0,
    "log": [],
    "error": None,
}


def _push_log(message: str) -> None:
    with _lock:
        _state["log"].append(message)
        if len(_state["log"]) > MAX_LOG_LINES:
            _state["log"] = _state["log"][-MAX_LOG_LINES:]


def _set_status(status: str, **extra) -> None:
    with _lock:
        _state["status"] = status
        _state.update(extra)


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/status")
def get_status():
    with _lock:
        return jsonify(dict(_state))


@app.post("/api/prepare-browser")
def prepare_browser():
    global _driver
    if _driver is not None:
        return jsonify({"ok": True, "message": "Browser sudah terbuka."})
    try:
        _driver = build_driver()
        _driver.get("https://shopee.co.id/")
        _set_status("browser_ready")
        _push_log("Browser terbuka. Silakan login ke Shopee di jendela Chrome, lalu klik Mulai Scrape.")
        return jsonify({"ok": True})
    except Exception as e:  # noqa: BLE001
        log.exception("Gagal membuka browser")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.post("/api/upload-csv")
def upload_csv():
    global _csv_rows, _csv_headers
    file = request.files.get("file")
    if not file:
        return jsonify({"ok": False, "error": "Tidak ada file yang diupload."}), 400

    try:
        text = file.read().decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        headers = reader.fieldnames or []
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "error": f"Gagal membaca CSV: {e}"}), 400

    if not rows:
        return jsonify({"ok": False, "error": "CSV kosong."}), 400

    _csv_rows = rows
    _csv_headers = headers
    detected = LINK_COLUMN_GUESS if LINK_COLUMN_GUESS in headers else None

    return jsonify({
        "ok": True,
        "headers": headers,
        "detected_column": detected,
        "row_count": len(rows),
    })


def _run_worker(link_column: str, base_url: str, username: str, password: str) -> None:
    global _control
    session = requests.Session()

    try:
        _push_log(f"Login ke {base_url} sebagai {username}...")
        site_client.login(session, base_url, username, password)
        _push_log("Login berhasil.")

        existing_ids = site_client.get_existing_product_ids(session, base_url)
        todo = [r for r in _csv_rows if r.get("ID Produk", "").strip() not in existing_ids]
        skipped = len(_csv_rows) - len(todo)
        _push_log(f"Total baris: {len(_csv_rows)} | sudah ada di database: {skipped} | akan di-scrape: {len(todo)}")

        if not todo:
            _push_log("Tidak ada produk baru untuk di-scrape.")
            _set_status("done", total=0, current=0)
            return

        _set_status("running", total=len(todo), current=0, success=0, failed=0)

        def on_result(csv_row: dict, scraped: dict) -> None:
            payload = build_api_payload(csv_row, scraped)
            site_client.create_product(session, base_url, payload)

        def progress_cb(index: int, total: int, message: str, ok: bool) -> None:
            with _lock:
                _state["current"] = index
                _state["total"] = total
                if ok:
                    _state["success"] += 1
                else:
                    _state["failed"] += 1
            _push_log(f"[{index}/{total}] {message}")

        success, failed = run_scrape_loop(
            _driver, todo, link_column, on_result, control=_control, progress_cb=progress_cb
        )

        final_status = "stopped" if _control.stopped else "done"
        _push_log(f"Selesai. Berhasil: {success}, Gagal: {failed}.")
        _set_status(final_status)
    except site_client.SiteAuthError as e:
        _push_log(f"Login gagal: {e}")
        _set_status("error", error=str(e))
    except Exception as e:  # noqa: BLE001
        log.exception("Scrape worker gagal")
        _push_log(f"Error tak terduga: {e}")
        _set_status("error", error=str(e))


@app.post("/api/start-scrape")
def start_scrape():
    global _control

    if _driver is None:
        return jsonify({"ok": False, "error": "Browser belum disiapkan. Klik 'Siapkan Browser' dulu."}), 400
    if not _csv_rows:
        return jsonify({"ok": False, "error": "Belum ada CSV yang diupload."}), 400

    body = request.get_json(force=True)
    link_column = body.get("link_column") or LINK_COLUMN_GUESS
    base_url = (body.get("base_url") or "").rstrip("/")
    username = body.get("username") or ""
    password = body.get("password") or ""

    if link_column not in (_csv_headers or []):
        return jsonify({"ok": False, "error": f"Kolom '{link_column}' tidak ada di CSV."}), 400
    if not base_url or not username or not password:
        return jsonify({"ok": False, "error": "Base URL, username, dan password wajib diisi."}), 400

    _control = ScrapeControl()
    thread = threading.Thread(
        target=_run_worker, args=(link_column, base_url, username, password), daemon=True
    )
    thread.start()

    return jsonify({"ok": True})


@app.post("/api/pause")
def pause():
    if _control is None:
        return jsonify({"ok": False, "error": "Belum ada proses scraping yang berjalan."}), 400
    _control.pause()
    _set_status("paused")
    _push_log("Dijeda oleh pengguna.")
    return jsonify({"ok": True})


@app.post("/api/resume")
def resume():
    if _control is None:
        return jsonify({"ok": False, "error": "Belum ada proses scraping yang berjalan."}), 400
    _control.resume()
    _set_status("running")
    _push_log("Dilanjutkan oleh pengguna.")
    return jsonify({"ok": True})


@app.post("/api/stop")
def stop():
    if _control is None:
        return jsonify({"ok": False, "error": "Belum ada proses scraping yang berjalan."}), 400
    _control.stop()
    _push_log("Menghentikan... (selesai setelah produk yang sedang diproses kelar)")
    return jsonify({"ok": True})


if __name__ == "__main__":
    # 127.0.0.1 only -- this panel must never be reachable from outside your PC,
    # since /api/start-scrape takes your admin password.
    # Port is overridable (PANEL_PORT env var) in case something else already
    # holds 5000 -- e.g. a stale/killed process leaving a lingering socket.
    port = int(os.environ.get("PANEL_PORT", 5000))
    app.run(host="127.0.0.1", port=port, threaded=True)
