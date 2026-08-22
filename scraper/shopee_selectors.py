"""Central place for Shopee page selectors.

Shopee's frontend uses hashed/auto-generated CSS class names (CSS Modules)
that change whenever they redeploy their frontend -- sometimes every few
weeks. When this scraper starts returning empty fields, THIS is almost
always the file to fix first: open a product page, inspect the element,
and update the class name below.

Every field also has a text-pattern fallback (see scrape.py's
`find_by_text_near` helper) so a single broken class name doesn't take
the whole scrape down -- but the CSS selector is tried first because it's
faster and more precise when it's still valid.
"""

# Price, e.g. <div class="PcnXj1">Rp429.000</div>
PRICE_CSS = "div.PcnXj1"

# Breadcrumb: confirmed from a real scraped page (2026-07-15) --
# category/subcategory/item are <a class="Tc_yqt"> links inside
# .page-product__breadcrumb; the product TITLE is a separate, non-link
# <span class="jrzBcd"> at the end of that same row (NOT the last link).
BREADCRUMB_CSS = "div.page-product__breadcrumb a.Tc_yqt"
BREADCRUMB_TITLE_CSS = "div.page-product__breadcrumb span.jrzBcd"

# Product photo gallery -- confirmed from a real scraped page: the small
# (82px) thumbnail strip lives inside div.qIctnQ, each <img class="P39yUt">.
# IMPORTANT: if the product has a preview VIDEO, the FIRST thumbnail in
# this strip is the video's cover frame, not a real product photo -- see
# scrape_gallery_images() in scrape.py, which drops it when a <video>
# element is present on the page.
GALLERY_THUMB_CSS = "div.qIctnQ img.P39yUt"
HERO_VIDEO_CSS = "video"

# Rating value, e.g. "4.9" near the ratings summary block
RATING_CSS = "div.product-rating-overview__rating-score"

# "565 penilaian" / "1RB+ Terjual" / "Dikirim Dari" live in a loosely
# structured row of stats near the price -- these are matched by TEXT
# pattern in scrape.py rather than a fixed class, since that markup is
# the most volatile part of the page.
SOLD_TEXT_PATTERN = r"([\d.,]+\s*(?:RB|JT)?\+?)\s*Terjual"
RATING_COUNT_TEXT_PATTERN = r"([\d.,]+\s*(?:RB|JT)?)\s*penilaian"
SHIP_FROM_LABEL_TEXT = "Dikirim Dari"

# Confirmed from a real out-of-stock product page (2026-08-07): Shopee
# renders a plain "STOK HABIS" <div> near the buy buttons regardless of
# variant selection -- reliable even though the buy buttons' own disabled
# state is ambiguous (they're also disabled before a variant is picked).
OUT_OF_STOCK_TEXT_PATTERN = r"STOK\s+HABIS"

# --- Shopee's blocking responses -------------------------------------------
#
# Shopee does not answer a throttled request with one page, it answers with
# four different ones. Every pattern below is the literal visible text of a
# real saved page in scraper/debug/, not a guess:
#
#   "Verifikasi untuk melanjutkan"            26 Jul
#   "Halaman Tidak Tersedia ... ID: 3500..."  20 Jul, 17 Aug
#   "Terjadi Kesalahan ... Coba Lagi"         20 Jul
#   (header+footer render, no product body)   10, 20, 22 Aug
#
# Until now all four looked identical to the scraper -- an empty breadcrumb,
# blamed on a stale selector. The selectors were never the problem: on a page
# that DID work, Tc_yqt / P39yUt / PcnXj1 are all present.
#
# !! These must only ever be matched against document.body.innerText, NEVER
# against page_source. Shopee ships its i18n dictionary in the JS bundle of
# every page, so the raw HTML of a perfectly healthy product page contains
# "verifikasi" 24 times and "captcha" 11 times. Matching HTML would classify
# every single page as blocked.
VERIFICATION_TEXT_PATTERN = r"Verifikasi untuk melanjutkan"
PAGE_UNAVAILABLE_TEXT_PATTERN = r"Halaman Tidak Tersedia"
# Both halves required: "Coba Lagi" alone is a common button label, and
# "Terjadi Kesalahan" alone risks matching an unrelated inline error.
TRANSIENT_ERROR_TEXT_PATTERN = r"Terjadi Kesalahan[\s\S]{0,200}?Coba Lagi"
