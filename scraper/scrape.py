"""Scrapes Shopee product pages listed in a Shopee affiliate CSV export and
writes a CSV ready to import via the SEMUADA admin dashboard's "Import" button
(client/src/components/admin/ProductManagementTab.tsx).

Usage:
    python scrape.py "path/to/Produk A.csv" "path/to/output.csv"

Input CSV must be a Shopee affiliate dashboard export with (at least) these
columns: "ID Produk", "Nama Produk", "Nama Toko", "Komisi", "Link Produk",
"Link Komisi Ekstra".

Safe to re-run: already-scraped "ID Produk" rows (present in the output
file) are skipped, so an interrupted run can just be restarted.
"""
import argparse
import csv
import logging
import random
import re
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import undetected_chromedriver as uc
from selenium.common.exceptions import NoSuchElementException, TimeoutException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

import shopee_selectors as sel
from parsers import parse_count, parse_price, parse_rating

OUTPUT_HEADERS = [
    "product_id", "product_name", "price", "sales", "category", "subcategory",
    "item", "affiliate_url", "image_url", "image_url_2", "image_url_3",
    "image_url_4", "image_url_5", "video_url", "original_price",
    "dikirim_dari", "toko", "komisi", "is_featured", "featured_order",
    "rating", "stock_available",
]

MAX_GALLERY_IMAGES = 5

PAGE_LOAD_TIMEOUT = 20
# Delay between products -- deliberately slow ("human mode") so Shopee's
# bot-detection sees a browsing pace rather than a scraping pace.
MIN_DELAY_SECONDS = 25
MAX_DELAY_SECONDS = 32

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("scrape")


def read_input_rows(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read_already_scraped_ids(output_path: Path) -> set[str]:
    if not output_path.exists():
        return set()
    with open(output_path, encoding="utf-8-sig", newline="") as f:
        return {row["product_id"] for row in csv.DictReader(f) if row.get("product_id")}


def ensure_output_header(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        return
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        csv.DictWriter(f, fieldnames=OUTPUT_HEADERS).writeheader()


def append_output_row(output_path: Path, row: dict) -> None:
    with open(output_path, "a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_HEADERS)
        writer.writerow(row)


CHROME_PROFILE_DIR = Path(__file__).parent / "chrome_profile"


def build_driver() -> uc.Chrome:
    options = uc.ChromeOptions()
    # Persistent profile: cookies/login survive between runs, so you only
    # have to log into Shopee once (not before every single scrape run).
    CHROME_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    options.add_argument(f"--user-data-dir={CHROME_PROFILE_DIR}")
    # Headed on purpose -- headless is far more likely to be flagged by Shopee.
    return uc.Chrome(options=options)


def wait_for_manual_login(driver) -> None:
    driver.get("https://shopee.co.id/")
    print("\n" + "=" * 70)
    print("Silakan LOGIN ke akun Shopee kamu di jendela Chrome yang baru terbuka.")
    print("Kalau sudah kelihatan halaman utama Shopee dalam keadaan login,")
    print("kembali ke terminal ini lalu tekan ENTER untuk mulai scraping.")
    print("(Login ini cuma perlu sekali -- run berikutnya otomatis tetap login)")
    print("=" * 70)
    input("Tekan ENTER setelah login selesai... ")


def scrape_breadcrumb(driver) -> tuple[str, str, str, str | None]:
    """Returns (category, subcategory, item, scraped_title_or_None).

    Shopee's breadcrumb row is "Shopee > Category > Subcategory > Item"
    as <a class="Tc_yqt"> links, PLUS the product title as a separate,
    non-link <span class="jrzBcd"> at the end of the same row -- the
    title is not one of the link segments.
    """
    elements = driver.find_elements(By.CSS_SELECTOR, sel.BREADCRUMB_CSS)
    segments = [el.text.strip() for el in elements if el.text.strip()]
    # Drop the leading site-name breadcrumb node (e.g. "Shopee").
    if segments and segments[0].lower() in ("shopee", "semuada"):
        segments = segments[1:]

    title = None
    try:
        title_el = driver.find_element(By.CSS_SELECTOR, sel.BREADCRUMB_TITLE_CSS)
        title = title_el.text.strip() or None
    except NoSuchElementException:
        pass

    if not segments:
        return "Lainnya", "", "", title

    category = segments[0] if len(segments) >= 1 else "Lainnya"
    subcategory = segments[1] if len(segments) >= 2 else ""
    item = segments[2] if len(segments) >= 3 else ""
    return category, subcategory, item, title


def scrape_price(driver, body_text: str) -> int | None:
    try:
        el = driver.find_element(By.CSS_SELECTOR, sel.PRICE_CSS)
        price = parse_price(el.text)
        if price:
            return price
    except NoSuchElementException:
        pass
    # Fallback: first "Rp..." occurrence anywhere on the page.
    match = re.search(r"Rp[\d.,]+", body_text)
    return parse_price(match.group(0)) if match else None


def scrape_original_price(body_text: str) -> int | None:
    """Only present on discounted products, e.g. 'Rp379.000 Rp1.000.000 -62%'
    -- the current price, then the struck-through original price, then the
    discount badge. Requiring the trailing '-NN%' avoids false-matching two
    unrelated 'Rp...' amounts elsewhere on the page."""
    match = re.search(r"Rp[\d.,]+\s*Rp([\d.,]+)\s*-\s*\d+\s*%", body_text)
    return parse_price(match.group(1)) if match else None


def scrape_rating(driver, body_text: str) -> float | None:
    try:
        el = driver.find_element(By.CSS_SELECTOR, sel.RATING_CSS)
        rating = parse_rating(el.text)
        if rating is not None:
            return rating
    except NoSuchElementException:
        pass
    match = re.search(r"\b([0-5][.,]\d)\b", body_text)
    return parse_rating(match.group(1)) if match else None


def scrape_sold_count(body_text: str) -> int | None:
    match = re.search(sel.SOLD_TEXT_PATTERN, body_text, re.IGNORECASE)
    return parse_count(match.group(1)) if match else None


def scrape_ship_from(body_text: str) -> str:
    idx = body_text.find(sel.SHIP_FROM_LABEL_TEXT)
    if idx == -1:
        return ""
    after = body_text[idx + len(sel.SHIP_FROM_LABEL_TEXT):idx + len(sel.SHIP_FROM_LABEL_TEXT) + 120]
    line = next((l.strip() for l in after.splitlines() if l.strip()), "")
    return line


def _to_webp(src: str) -> str:
    """Strips Shopee's thumbnail/resize suffixes and appends .webp for a
    lightweight, full-resolution image URL, e.g.:
    '.../file/id-xxx_tn' -> '.../file/id-xxx.webp'
    '.../file/id-xxx@resize_w320_nl' -> '.../file/id-xxx.webp'
    """
    base = re.sub(r"(_tn|@resize_\w+_nl)$", "", src)
    return f"{base}.webp"


def scrape_gallery_images(driver) -> list[str]:
    """Returns up to MAX_GALLERY_IMAGES real product photo URLs (as .webp).

    If the product has a preview video, Shopee's thumbnail strip puts the
    video's cover frame first -- that's not a real photo, so it's dropped
    whenever a <video> element is present on the page (confirmed against a
    real product page that had one).
    """
    thumbs = driver.find_elements(By.CSS_SELECTOR, sel.GALLERY_THUMB_CSS)
    has_video = bool(driver.find_elements(By.CSS_SELECTOR, sel.HERO_VIDEO_CSS))
    if has_video and thumbs:
        thumbs = thumbs[1:]

    urls: list[str] = []
    for thumb in thumbs:
        if len(urls) >= MAX_GALLERY_IMAGES:
            break
        src = thumb.get_attribute("src") or thumb.get_attribute("data-src") or ""
        if not src:
            continue
        webp_url = _to_webp(src)
        if webp_url not in urls:
            urls.append(webp_url)
    return urls


def human_scroll(driver) -> None:
    """Scrolls down in a few uneven steps with pauses, like someone actually
    reading the page, instead of jumping straight to scraping. Also helps
    trigger lazy-loaded images/price blocks that only render once in view."""
    total_scrolled = 0
    steps = random.randint(3, 6)
    for _ in range(steps):
        distance = random.randint(250, 700)
        driver.execute_script(f"window.scrollBy(0, {distance});")
        total_scrolled += distance
        time.sleep(random.uniform(0.6, 1.8))
    # Small chance of scrolling back up a bit, like a human re-checking something.
    if random.random() < 0.3:
        driver.execute_script(f"window.scrollBy(0, -{random.randint(100, 300)});")
        time.sleep(random.uniform(0.4, 1.0))


DEBUG_DIR = Path(__file__).parent / "debug"
_debug_dumped_reasons: set[str] = set()


def dump_debug_page(driver, product_id: str, reason: str) -> None:
    """Saves the current page HTML once per failure reason, so selectors.py
    can be fixed with real evidence instead of guessing blind."""
    if reason in _debug_dumped_reasons:
        return
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    out_file = DEBUG_DIR / f"{reason}_product_{product_id}.html"
    out_file.write_text(driver.page_source, encoding="utf-8")
    log.warning("  [%s] kosong -- halaman disimpan ke %s untuk didiagnosis", reason, out_file)
    _debug_dumped_reasons.add(reason)


def scrape_product(driver, product_url: str, product_id: str = "") -> dict:
    driver.get(product_url)
    WebDriverWait(driver, PAGE_LOAD_TIMEOUT).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    )
    # Give client-side rendered content (price, breadcrumb, etc.) time to paint.
    time.sleep(3)
    human_scroll(driver)

    body_text = driver.find_element(By.TAG_NAME, "body").text

    category, subcategory, item, scraped_title = scrape_breadcrumb(driver)
    price = scrape_price(driver, body_text)
    original_price = scrape_original_price(body_text)
    rating = scrape_rating(driver, body_text)
    sold = scrape_sold_count(body_text)
    ship_from = scrape_ship_from(body_text)
    gallery = scrape_gallery_images(driver)

    if category == "Lainnya" and not subcategory:
        dump_debug_page(driver, product_id, "breadcrumb")
    if not gallery:
        dump_debug_page(driver, product_id, "image")
    elif len(gallery) == 1:
        dump_debug_page(driver, product_id, "gallery")

    return {
        "product_name": scraped_title,
        "price": price,
        "original_price": original_price,
        "sales": sold,
        "category": category,
        "subcategory": subcategory,
        "item": item,
        "image_urls": gallery,
        "dikirim_dari": ship_from,
        "rating": rating,
    }


def build_output_row(csv_row: dict, scraped: dict) -> dict:
    product_id = csv_row.get("ID Produk", "").strip()
    product_name = scraped.get("product_name") or csv_row.get("Nama Produk", "").strip()
    komisi = parse_price(csv_row.get("Komisi", "")) or ""
    gallery = scraped.get("image_urls") or []

    return {
        "product_id": product_id,
        "product_name": product_name,
        "price": scraped.get("price") or "",
        "sales": scraped.get("sales") or "",
        "category": scraped.get("category") or "Lainnya",
        "subcategory": scraped.get("subcategory") or "",
        "item": scraped.get("item") or "",
        "affiliate_url": csv_row.get("Link Komisi Ekstra", "").strip(),
        "image_url": gallery[0] if len(gallery) >= 1 else "",
        "image_url_2": gallery[1] if len(gallery) >= 2 else "",
        "image_url_3": gallery[2] if len(gallery) >= 3 else "",
        "image_url_4": gallery[3] if len(gallery) >= 4 else "",
        "image_url_5": gallery[4] if len(gallery) >= 5 else "",
        "video_url": "",
        "original_price": scraped.get("original_price") or "",
        "dikirim_dari": scraped.get("dikirim_dari") or "",
        "toko": csv_row.get("Nama Toko", "").strip(),
        "komisi": komisi,
        "is_featured": "false",
        "featured_order": "",
        "rating": scraped.get("rating") or "",
        "stock_available": "true",
    }


@dataclass
class ScrapeControl:
    """Lets an external caller (e.g. a Flask route) pause/stop a scrape loop
    that's running in a background thread. `paused` follows threading.Event
    convention inverted for readability: set() = running, clear() = paused."""
    _running: threading.Event = field(default_factory=threading.Event)
    _stop: threading.Event = field(default_factory=threading.Event)

    def __post_init__(self):
        self._running.set()  # not paused by default

    def pause(self) -> None:
        self._running.clear()

    def resume(self) -> None:
        self._running.set()

    def stop(self) -> None:
        self._stop.set()
        self._running.set()  # wake up if currently paused, so it can see stopped and exit

    @property
    def stopped(self) -> bool:
        return self._stop.is_set()

    @property
    def paused(self) -> bool:
        return not self._running.is_set()

    def wait_if_paused(self) -> None:
        """Blocks here while paused; returns immediately once resumed or stopped."""
        self._running.wait()

    def interruptible_sleep(self, seconds: float) -> None:
        """Sleeps in 1s ticks, checking pause/stop each tick, so Pause/Stop
        react within ~1s instead of waiting out a full 25-32s delay."""
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if self.stopped:
                return
            self.wait_if_paused()
            if self.stopped:
                return
            time.sleep(min(1.0, deadline - time.monotonic()))


def run_scrape_loop(
    driver,
    rows: list[dict],
    link_column: str,
    on_result: Callable[[dict, dict], None],
    control: Optional[ScrapeControl] = None,
    progress_cb: Optional[Callable[[int, int, str, bool], None]] = None,
) -> tuple[int, int]:
    """Scrapes each row's `link_column` URL and calls on_result(csv_row,
    scraped) for every success. Shared by the CLI (writes CSV rows) and the
    local control panel (POSTs straight to the site's API).

    progress_cb(index, total, message, ok) is called after every row
    (success or failure) so a caller can report live progress.
    """
    control = control or ScrapeControl()
    success, failed = 0, 0

    for i, row in enumerate(rows, start=1):
        if control.stopped:
            log.info("Dihentikan oleh pengguna pada baris %d/%d.", i, len(rows))
            break

        control.wait_if_paused()
        if control.stopped:
            break

        product_id = row.get("ID Produk", "").strip()
        product_url = row.get(link_column, "").strip()
        if not product_url:
            log.warning("[%d/%d] Lewati ID %s: kolom '%s' kosong", i, len(rows), product_id, link_column)
            if progress_cb:
                progress_cb(i, len(rows), f"Lewati ID {product_id}: link kosong", False)
            continue

        try:
            log.info("[%d/%d] Scraping ID %s -> %s", i, len(rows), product_id, product_url)
            scraped = scrape_product(driver, product_url, product_id)
            on_result(row, scraped)
            success += 1
            msg = f"OK: {scraped.get('product_name')} | Rp{scraped.get('price')} | {scraped.get('category')} > {scraped.get('subcategory')} > {scraped.get('item')}"
            log.info("  %s", msg)
            if progress_cb:
                progress_cb(i, len(rows), msg, True)
        except (TimeoutException, WebDriverException) as e:
            failed += 1
            log.error("  GAGAL ID %s: %s", product_id, e)
            if progress_cb:
                progress_cb(i, len(rows), f"GAGAL ID {product_id}: {e}", False)
        except Exception as e:  # noqa: BLE001 - keep the batch running no matter what
            failed += 1
            log.error("  GAGAL ID %s (unexpected): %s", product_id, e)
            if progress_cb:
                progress_cb(i, len(rows), f"GAGAL ID {product_id}: {e}", False)

        control.interruptible_sleep(random.uniform(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS))

    return success, failed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_csv", type=Path)
    parser.add_argument("output_csv", type=Path)
    args = parser.parse_args()

    rows = read_input_rows(args.input_csv)
    already_scraped = read_already_scraped_ids(args.output_csv)
    ensure_output_header(args.output_csv)

    todo = [r for r in rows if r.get("ID Produk", "").strip() not in already_scraped]
    log.info("Total baris: %d | sudah di-scrape sebelumnya: %d | sisa: %d",
              len(rows), len(already_scraped), len(todo))

    if not todo:
        log.info("Tidak ada baris baru untuk di-scrape. Selesai.")
        return

    driver = build_driver()

    def on_result(csv_row: dict, scraped: dict) -> None:
        append_output_row(args.output_csv, build_output_row(csv_row, scraped))

    try:
        wait_for_manual_login(driver)
        success, failed = run_scrape_loop(driver, todo, "Link Produk", on_result)
    finally:
        driver.quit()

    log.info("Selesai. Berhasil: %d, Gagal: %d. Output: %s", success, failed, args.output_csv)
    if failed:
        log.info("Jalankan ulang command yang sama untuk retry baris yang gagal (otomatis skip yang sudah sukses).")


if __name__ == "__main__":
    main()
