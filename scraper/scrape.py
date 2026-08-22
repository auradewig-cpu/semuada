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

import run_log
import shopee_selectors as sel
from blocking import (
    BLOCK_STALLED,
    BLOCK_TRANSIENT,
    BLOCK_VERIFICATION,
    BlockedError,
    classify_block,
    cooldown_seconds,
)
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
# Circuit breaker: abort the run early if this many rows in a row fail --
# almost always means Shopee is blocking the session or the admin login
# expired, so grinding through the rest of the CSV would just waste an hour.
# Counts real exceptions only; a blocked page has its own budget below.
MAX_CONSECUTIVE_FAILURES = 8
# Blocks get a separate, larger budget because they are survivable: the loop
# backs off between them (see blocking.cooldown_seconds) instead of retrying
# at full speed, and reaching this limit means Shopee is throttling hard
# enough that the session is better resumed later.
MAX_CONSECUTIVE_BLOCKS = 6
# A "Coba Lagi" page is Shopee telling us to retry, so retry it immediately
# rather than deferring the product to the end of the run.
MAX_TRANSIENT_RETRIES = 2
# Extra passes over the products that were blocked. Bounded so a session that
# is thoroughly throttled ends instead of looping.
MAX_RETRY_PASSES = 2

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


def _detect_installed_chrome_major_version() -> Optional[int]:
    """Reads the ACTUALLY installed Chrome version from the registry.

    undetected-chromedriver defaults to downloading the latest chromedriver
    release, assuming Chrome auto-updates in lockstep -- but Chrome doesn't
    always update immediately, so "latest driver" can end up newer than the
    browser that's actually installed and refuse to attach (SessionNotCreated:
    "This version of ChromeDriver only supports Chrome version X"). Pinning to
    the real installed version avoids that mismatch.
    """
    try:
        import winreg

        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Google\Chrome\BLBeacon")
        version, _ = winreg.QueryValueEx(key, "version")
        return int(version.split(".")[0])
    except Exception:  # noqa: BLE001 - best-effort, fall back to uc's own auto-detect
        return None


def build_driver() -> uc.Chrome:
    options = uc.ChromeOptions()
    # Persistent profile: cookies/login survive between runs, so you only
    # have to log into Shopee once (not before every single scrape run).
    CHROME_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    options.add_argument(f"--user-data-dir={CHROME_PROFILE_DIR}")
    # "eager" = driver.get() returns once the DOM is ready (DOMContentLoaded),
    # instead of Selenium's default "normal" strategy which waits for the
    # browser's full "load" event -- ads/trackers/beacons on a page like
    # Shopee's can keep the network "busy" indefinitely and that event may
    # never fire, which is what was hanging the scraper. We only need the
    # DOM (checked again below via WebDriverWait for <body>), not every
    # last background request to finish.
    options.page_load_strategy = "eager"
    # Headed on purpose -- headless is far more likely to be flagged by Shopee.
    driver = uc.Chrome(options=options, version_main=_detect_installed_chrome_major_version())
    # Extra safety net in case "eager" still isn't enough on some page.
    #
    # Raised from 30s on 2026-08-22: a real run recorded successful loads at 5,
    # 19, 22 and 7 seconds to DOMContentLoaded, so 30 left almost no margin --
    # one product hit the ceiling exactly and another came within 0.1s of it.
    # A stalled load is now retried later (BLOCK_STALLED) rather than dropped,
    # so waiting a little longer is far cheaper than losing the product.
    driver.set_page_load_timeout(45)
    # Selenium's default HTTP timeout to chromedriver is 120s PER ATTEMPT,
    # retried up to 3 times -- so one slow command (e.g. reading .text off a
    # huge/animating page) can block for 6+ minutes before finally raising.
    # Cut that down so a stuck command fails fast instead.
    driver.command_executor.set_timeout(45)
    return driver


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


class OutOfStockError(Exception):
    """Raised by scrape_product() to signal the product should be skipped --
    caught separately in run_scrape_loop() so it's never counted as a scrape
    failure (doesn't trip the consecutive-failure circuit breaker)."""


def is_out_of_stock(body_text: str) -> bool:
    return bool(re.search(sel.OUT_OF_STOCK_TEXT_PATTERN, body_text, re.IGNORECASE))


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
    # A load that never completes is Shopee withholding the response, not a
    # broken browser or a bad URL -- the same throttling as the other blocking
    # pages, only there is no page left behind to inspect. Reported as a block
    # so it gets a cool-down and a retry, instead of counting as a hard failure
    # that is dropped and pushes the run toward the circuit breaker.
    #
    # Scoped tightly to the two page-load calls: a TimeoutException from
    # anywhere else (a hung execute_script, say) still means something is
    # genuinely wrong and stays a failure.
    try:
        driver.get(product_url)
        WebDriverWait(driver, PAGE_LOAD_TIMEOUT).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
    except TimeoutException as e:
        raise BlockedError(BLOCK_STALLED, product_id) from e

    # Give client-side rendered content (price, breadcrumb, etc.) time to paint.
    time.sleep(3)
    human_scroll(driver)

    # WebElement.text (via find_element(...).text) is notoriously slow on
    # large/complex pages -- Selenium has to walk every node checking
    # visibility. Shopee product pages are huge (related products, reviews,
    # ads), which is what was timing out every single row. Reading
    # document.body.innerText via JS runs natively in the browser and is
    # dramatically faster for the exact same text content.
    body_text = driver.execute_script("return document.body.innerText;")

    if is_out_of_stock(body_text):
        raise OutOfStockError(f"Produk stok habis: {product_id}")

    # Cheap check first: the three text-based blocking pages are recognisable
    # before any extraction work, so a blocked page costs almost nothing.
    text_block = classify_block(body_text)
    if text_block:
        dump_debug_page(driver, product_id, f"diblokir_{text_block}")
        raise BlockedError(text_block, product_id)

    category, subcategory, item, scraped_title = scrape_breadcrumb(driver)
    price = scrape_price(driver, body_text)
    original_price = scrape_original_price(body_text)
    rating = scrape_rating(driver, body_text)
    sold = scrape_sold_count(body_text)
    ship_from = scrape_ship_from(body_text)
    gallery = scrape_gallery_images(driver)

    # The fourth blocking page has no distinguishing text at all: header and
    # footer render (the session is alive, other APIs answer) while the
    # product body never arrives. It shows up as everything being missing at
    # once, which is why all three flags must agree before calling it a block.
    breadcrumb_empty = category == "Lainnya" and not subcategory
    shell_block = classify_block(body_text, breadcrumb_empty, not gallery, price is None)
    if shell_block:
        dump_debug_page(driver, product_id, f"diblokir_{shell_block}")
        raise BlockedError(shell_block, product_id)

    # Past this point the page really is a product page, so an empty field
    # really can be a stale selector -- which is what these dumps are for.
    # They used to fire for blocked pages too, which is how five weeks of
    # throttling got misdiagnosed as a Shopee redesign.
    if breadcrumb_empty:
        dump_debug_page(driver, product_id, "selector_breadcrumb")
    if not gallery:
        dump_debug_page(driver, product_id, "selector_image")
    elif len(gallery) == 1:
        dump_debug_page(driver, product_id, "selector_gallery")

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


@dataclass
class ScrapeStats:
    """Outcome tally for a whole run, retry passes included."""
    success: int = 0
    failed: int = 0
    out_of_stock: int = 0
    blocked: int = 0
    recovered_on_retry: int = 0


# Outcome labels shared by the ledger, the progress callback and the panel's
# counters, so all three agree on what happened. Previously progress_cb took a
# bool, which forced an out-of-stock skip to be reported as a success and made
# the panel's "sukses" number lie.
OUTCOME_OK = "ok"
OUTCOME_FAILED = "gagal"
OUTCOME_OUT_OF_STOCK = "stok_habis"
OUTCOME_BLOCKED = "diblokir"
OUTCOME_INFO = "info"


def _scrape_with_transient_retry(driver, product_url: str, product_id: str, control: ScrapeControl) -> dict:
    """scrape_product(), but Shopee's "Terjadi Kesalahan ... Coba Lagi" page is
    retried in place first. That page is Shopee itself asking for a retry, so
    deferring the product to the end of the run would be a needless detour."""
    for attempt in range(MAX_TRANSIENT_RETRIES + 1):
        try:
            return scrape_product(driver, product_url, product_id)
        except BlockedError as e:
            if e.kind != BLOCK_TRANSIENT or attempt >= MAX_TRANSIENT_RETRIES:
                raise
            wait = cooldown_seconds(BLOCK_TRANSIENT, 1)
            log.info("  Error sementara pada ID %s -- coba lagi dalam %ds (percobaan %d)", product_id, wait, attempt + 2)
            control.interruptible_sleep(wait)
            if control.stopped:
                raise
    raise BlockedError(BLOCK_TRANSIENT, product_id)  # unreachable, keeps type checkers happy


def run_scrape_loop(
    driver,
    rows: list[dict],
    link_column: str,
    on_result: Callable[[dict, dict], None],
    control: Optional[ScrapeControl] = None,
    progress_cb: Optional[Callable[[int, int, str, str], None]] = None,
    on_verification: Optional[Callable[[str], None]] = None,
    run_id: Optional[str] = None,
) -> ScrapeStats:
    """Scrapes each row's `link_column` URL and calls on_result(csv_row,
    scraped) for every success. Shared by the CLI (writes CSV rows) and the
    local control panel (POSTs straight to the site's API).

    progress_cb(index, total, message, outcome) is called after every row, with
    outcome one of the OUTCOME_* labels above.

    on_verification(message) is called when Shopee shows its verification gate,
    which no amount of waiting can clear -- it needs the person sitting in front
    of the headed browser. The panel passes a handler that pauses and notifies;
    callers without one (the CLI) get a clean stop instead of a hang.

    Products that were blocked are retried in up to MAX_RETRY_PASSES further
    passes, because blocks here are demonstrably temporary: several products
    that hit a blocking page scraped perfectly on a later attempt.
    """
    control = control or ScrapeControl()
    run_id = run_id or run_log.new_run_id()
    stats = ScrapeStats()

    pending = list(rows)
    for pass_index in range(MAX_RETRY_PASSES + 1):
        if not pending or control.stopped:
            break
        if pass_index > 0:
            msg = f"Lintasan ulang {pass_index}: mencoba lagi {len(pending)} produk yang sempat diblokir."
            log.info(msg)
            if progress_cb:
                progress_cb(0, len(pending), msg, OUTCOME_INFO)
        before = stats.success
        pending = _run_one_pass(
            driver, pending, link_column, on_result, control, progress_cb, on_verification, run_id, stats
        )
        if pass_index > 0:
            stats.recovered_on_retry += stats.success - before

    if pending and not control.stopped:
        msg = f"{len(pending)} produk masih diblokir setelah {MAX_RETRY_PASSES} lintasan ulang -- coba lagi nanti."
        log.warning(msg)
        if progress_cb:
            progress_cb(0, len(pending), msg, OUTCOME_INFO)

    return stats


def _run_one_pass(
    driver,
    rows: list[dict],
    link_column: str,
    on_result: Callable[[dict, dict], None],
    control: ScrapeControl,
    progress_cb: Optional[Callable[[int, int, str, str], None]],
    on_verification: Optional[Callable[[str], None]],
    run_id: str,
    stats: ScrapeStats,
) -> list[dict]:
    """One sweep over `rows`. Returns the rows that were blocked, for the
    caller to retry."""
    consecutive_failures = 0
    consecutive_blocks = 0
    blocked_rows: list[dict] = []
    total = len(rows)

    for i, row in enumerate(rows, start=1):
        if control.stopped:
            log.info("Dihentikan oleh pengguna pada baris %d/%d.", i, total)
            break

        control.wait_if_paused()
        if control.stopped:
            break

        product_id = row.get("ID Produk", "").strip()
        product_url = row.get(link_column, "").strip()
        if not product_url:
            log.warning("[%d/%d] Lewati ID %s: kolom '%s' kosong", i, total, product_id, link_column)
            if progress_cb:
                progress_cb(i, total, f"Lewati ID {product_id}: link kosong", OUTCOME_INFO)
            continue

        started = time.monotonic()
        # Set when a cool-down already ran, so the normal browsing delay isn't
        # stacked on top of a 10-minute wait.
        skip_normal_delay = False

        try:
            log.info("[%d/%d] Scraping ID %s -> %s", i, total, product_id, product_url)
            scraped = _scrape_with_transient_retry(driver, product_url, product_id, control)
            on_result(row, scraped)
            stats.success += 1
            consecutive_failures = 0
            consecutive_blocks = 0
            msg = f"OK: {scraped.get('product_name')} | Rp{scraped.get('price')} | {scraped.get('category')} > {scraped.get('subcategory')} > {scraped.get('item')}"
            log.info("  %s", msg)
            run_log.append_ledger(run_id, product_id, OUTCOME_OK, time.monotonic() - started)
            if progress_cb:
                progress_cb(i, total, msg, OUTCOME_OK)
        except OutOfStockError:
            stats.out_of_stock += 1
            # Not a scrape failure -- don't trip the circuit breaker, and
            # reset it since this proves the session/connection is fine.
            consecutive_failures = 0
            consecutive_blocks = 0
            log.info("  [%d/%d] Dilewati ID %s: stok habis", i, total, product_id)
            run_log.append_ledger(run_id, product_id, OUTCOME_OUT_OF_STOCK, time.monotonic() - started)
            if progress_cb:
                progress_cb(i, total, f"Dilewati ID {product_id}: stok habis", OUTCOME_OUT_OF_STOCK)
        except BlockedError as e:
            # A block carries no product data, so on_result is never called --
            # the database holds zero junk rows today and must keep holding
            # zero. The row is queued for a later pass instead.
            stats.blocked += 1
            consecutive_blocks += 1
            blocked_rows.append(row)
            # A blocking page proves the session still works; only real
            # exceptions say the session is broken.
            consecutive_failures = 0
            run_log.append_ledger(run_id, product_id, f"{OUTCOME_BLOCKED}_{e.kind}", time.monotonic() - started)

            if e.kind == BLOCK_VERIFICATION:
                msg = (
                    f"Shopee minta VERIFIKASI pada ID {product_id}. Selesaikan verifikasinya di "
                    f"jendela Chrome yang terbuka, lalu klik Lanjutkan di panel."
                )
                log.warning("  %s", msg)
                if progress_cb:
                    progress_cb(i, total, msg, OUTCOME_BLOCKED)
                if on_verification:
                    on_verification(msg)
                    # Blocks here until the person resumes from the panel.
                    control.wait_if_paused()
                    consecutive_blocks = 0
                else:
                    # Nothing can clear a captcha unattended, and the CLI has
                    # no resume path -- stop cleanly rather than spin.
                    log.error("  Tidak ada cara melanjutkan otomatis -- run dihentikan.")
                    control.stop()
                    break
            else:
                wait = cooldown_seconds(e.kind, consecutive_blocks)
                msg = f"Diblokir ({e.kind}) pada ID {product_id} -- istirahat {wait // 60}m {wait % 60}s sebelum lanjut."
                log.warning("  %s", msg)
                if progress_cb:
                    progress_cb(i, total, msg, OUTCOME_BLOCKED)
                control.interruptible_sleep(wait)
                skip_normal_delay = True
        except (TimeoutException, WebDriverException) as e:
            stats.failed += 1
            consecutive_failures += 1
            log.error("  GAGAL ID %s: %s", product_id, e)
            run_log.append_ledger(run_id, product_id, OUTCOME_FAILED, time.monotonic() - started, str(e))
            if progress_cb:
                progress_cb(i, total, f"GAGAL ID {product_id}: {e}", OUTCOME_FAILED)
        except Exception as e:  # noqa: BLE001 - keep the batch running no matter what
            stats.failed += 1
            consecutive_failures += 1
            log.error("  GAGAL ID %s (unexpected): %s", product_id, e)
            run_log.append_ledger(run_id, product_id, OUTCOME_FAILED, time.monotonic() - started, str(e))
            if progress_cb:
                progress_cb(i, total, f"GAGAL ID {product_id}: {e}", OUTCOME_FAILED)

        if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            reason = (
                f"Berhenti otomatis: {consecutive_failures} produk gagal berturut-turut -- "
                f"kemungkinan sesi admin/login sudah tidak valid atau koneksi bermasalah. "
                f"Cek koneksi/login lalu coba lagi (produk yang sudah berhasil tidak akan diulang)."
            )
            log.error(reason)
            if progress_cb:
                progress_cb(i, total, reason, OUTCOME_FAILED)
            control.stop()
            break

        if consecutive_blocks >= MAX_CONSECUTIVE_BLOCKS:
            reason = (
                f"Berhenti otomatis: {consecutive_blocks} produk diblokir berturut-turut meski sudah "
                f"istirahat bertahap -- Shopee sedang membatasi sesi ini cukup keras. Lanjutkan nanti; "
                f"produk yang sudah berhasil tidak akan diulang."
            )
            log.error(reason)
            if progress_cb:
                progress_cb(i, total, reason, OUTCOME_BLOCKED)
            control.stop()
            break

        if not skip_normal_delay:
            control.interruptible_sleep(random.uniform(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS))

    # Rows never reached because the pass stopped early are not "blocked" --
    # returning them would retry them under the same conditions that just
    # stopped the run.
    return blocked_rows


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

    run_id = run_log.new_run_id()
    run_log.attach_file_handler(log)

    try:
        wait_for_manual_login(driver)
        stats = run_scrape_loop(driver, todo, "Link Produk", on_result, run_id=run_id)
    finally:
        driver.quit()

    log.info(
        "Selesai. Berhasil: %d (%d di antaranya lewat lintasan ulang), Gagal: %d, "
        "Stok habis: %d, Diblokir: %d. Output: %s",
        stats.success, stats.recovered_on_retry, stats.failed,
        stats.out_of_stock, stats.blocked, args.output_csv
    )
    log.info("Rincian per produk: %s", run_log.LEDGER_PATH)
    if stats.failed or stats.blocked:
        log.info("Jalankan ulang command yang sama untuk retry baris yang gagal/diblokir (otomatis skip yang sudah sukses).")


if __name__ == "__main__":
    main()
