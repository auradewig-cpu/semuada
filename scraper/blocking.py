"""Recognising Shopee's blocking pages, and deciding how long to back off.

Shopee does not answer a throttled request with one page -- it answers with
four different ones, and until now the scraper treated all four the same way:
an empty breadcrumb, blamed on a stale CSS selector. That sent every
investigation down the wrong path (the selectors were fine all along).

The blocks are also TEMPORARY, which is what makes reacting worthwhile:
products 28969129033, 41271643096, 42452447868, 3179185867 and 49063544911
each hit a blocking page and then scraped perfectly on a later attempt. So
the right response is to wait and try again, not to drop the product and keep
hammering at the same pace -- steady hammering through a block is exactly the
pattern that confirms automation.
"""
import re

import shopee_selectors as sel

# Kinds, in the order classify_block() tests them.
BLOCK_VERIFICATION = "verifikasi"
BLOCK_UNAVAILABLE = "halaman_tidak_tersedia"
BLOCK_TRANSIENT = "error_sementara"
BLOCK_SHELL = "halaman_cangkang"
# The fifth face, and the only one classify_block() cannot see: Shopee simply
# never answers, so the page load times out and there is no text to inspect.
# Measured on a real run 2026-08-22 -- the row consumed exactly the 30s page
# load budget, while the successful products either side of it took 5, 19, 22
# and 7 seconds to reach DOMContentLoaded on an "eager" strategy that should
# need a couple. A stall is a withheld response, not a broken browser, so it
# is treated like the other blocks: cool down and try again later.
BLOCK_STALLED = "muat_mandek"

# First cool-down per kind, in seconds. Doubled on each consecutive block and
# capped by COOLDOWN_MAX_SECONDS.
#
# - unavailable: a flat server-side refusal (it even carries a trace ID), so
#   start long.
# - shell: the app renders but the product API returns nothing -- a rate
#   limit, which the user observed clears after a few minutes of quiet.
# - transient: Shopee's own page says "Coba Lagi", so take it at its word.
# - verification: absent on purpose. No amount of waiting solves a captcha;
#   it needs a human, and the browser is headed with the user sitting there.
BASE_COOLDOWN_SECONDS = {
    BLOCK_UNAVAILABLE: 10 * 60,
    BLOCK_SHELL: 3 * 60,
    BLOCK_STALLED: 3 * 60,
    BLOCK_TRANSIENT: 45,
}
COOLDOWN_MAX_SECONDS = 30 * 60


class BlockedError(Exception):
    """Shopee served a blocking page instead of the product.

    Deliberately NOT a scrape failure: it carries no product data, so it must
    never reach on_result (the database currently holds zero junk rows out of
    1356 -- that stays true), and it must not trip the consecutive-failure
    circuit breaker, which exists for broken sessions rather than throttling.
    """

    def __init__(self, kind: str, product_id: str = ""):
        super().__init__(f"Diblokir Shopee ({kind}) pada produk {product_id}")
        self.kind = kind
        self.product_id = product_id


def classify_block(
    body_text: str,
    breadcrumb_empty: bool = False,
    gallery_empty: bool = False,
    price_missing: bool = False,
) -> str | None:
    """Returns the block kind, or None when this looks like a real product page.

    `body_text` MUST be document.body.innerText, never page_source. Shopee
    ships its i18n dictionary inside the JS bundle of every page, so the raw
    HTML of a perfectly healthy product page contains "verifikasi" 24 times
    and "captcha" 11 times -- matching against HTML would classify every page
    as blocked. The rendered text only contains those words when Shopee
    actually shows them.

    The three structural flags are optional so this can be called twice: once
    on the text alone, right after the page loads (cheap, skips the extraction
    work entirely), and again afterwards with what extraction found.
    """
    if re.search(sel.VERIFICATION_TEXT_PATTERN, body_text, re.IGNORECASE):
        return BLOCK_VERIFICATION
    if re.search(sel.PAGE_UNAVAILABLE_TEXT_PATTERN, body_text, re.IGNORECASE):
        return BLOCK_UNAVAILABLE
    if re.search(sel.TRANSIENT_ERROR_TEXT_PATTERN, body_text, re.IGNORECASE):
        return BLOCK_TRANSIENT
    # The shell: header and footer render (so the session is alive and the
    # other APIs answer), but the product body never arrives. Requiring all
    # three to be missing keeps a merely unusual product -- one with an odd
    # breadcrumb, say -- from being mistaken for a block: a real product page
    # always has at least a price.
    if breadcrumb_empty and gallery_empty and price_missing:
        return BLOCK_SHELL
    return None


def cooldown_seconds(kind: str, consecutive_blocks: int) -> int:
    """How long to wait after a block. Doubles per consecutive block so a
    session that Shopee has decided to throttle backs away instead of pushing,
    and resets (via the caller) as soon as one product succeeds."""
    base = BASE_COOLDOWN_SECONDS.get(kind, BASE_COOLDOWN_SECONDS[BLOCK_SHELL])
    escalated = base * (2 ** max(0, consecutive_blocks - 1))
    return min(escalated, COOLDOWN_MAX_SECONDS)
