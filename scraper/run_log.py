"""Persistent record of what every scrape run actually did.

Until now nothing survived a run: the control panel kept its log in memory
(300 lines, gone the moment the panel closed) and the CLI only printed to
stdout. So when a run stopped early there was no way to answer why, and the
only evidence left behind was a handful of HTML dumps -- which is how a
throttling problem spent five weeks being misread as a broken CSS selector.

Two outputs, both append-only:
  scraper/scrape_log.csv       one row per product attempt, for counting
  scraper/logs/panel-DATE.log  the human-readable log, for reading

Both are gitignored (scraper/*.csv already, scraper/logs/ added alongside).
"""
import csv
import logging
from datetime import datetime
from pathlib import Path

LEDGER_PATH = Path(__file__).parent / "scrape_log.csv"
LOG_DIR = Path(__file__).parent / "logs"

LEDGER_HEADERS = ["waktu", "run_id", "product_id", "hasil", "detik", "pesan"]


def new_run_id() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def append_ledger(run_id: str, product_id: str, outcome: str, seconds: float, message: str = "") -> None:
    """One row per attempt. Never raises: a logging failure must not be able
    to kill a scrape run that is otherwise working."""
    try:
        is_new = not LEDGER_PATH.exists()
        with open(LEDGER_PATH, "a", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=LEDGER_HEADERS)
            if is_new:
                writer.writeheader()
            writer.writerow({
                "waktu": datetime.now().isoformat(timespec="seconds"),
                "run_id": run_id,
                "product_id": product_id,
                "hasil": outcome,
                "detik": round(seconds, 1),
                # Commas/newlines are handled by csv, but a provider error can
                # be enormous -- keep the file readable.
                "pesan": (message or "")[:300],
            })
    except Exception:  # noqa: BLE001 - logging must never break scraping
        pass


def attach_file_handler(logger: logging.Logger) -> Path | None:
    """Mirrors an existing logger to scraper/logs/panel-YYYYMMDD.log, keeping
    whatever handlers it already has (stdout stays as it is)."""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        path = LOG_DIR / f"panel-{datetime.now().strftime('%Y%m%d')}.log"
        handler = logging.FileHandler(path, encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(handler)
        return path
    except Exception:  # noqa: BLE001
        return None
