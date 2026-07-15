"""Helper parsers for Shopee's Indonesian number/price notation.

Shopee formats numbers in a few different ways depending on context:
  - Prices: "Rp429.000" or "429,0RB" (thousands separator differs from plain digits)
  - Sold/review counts: "1RB+" (ribu/thousand), "3JT+" (juta/million), or plain "565"
This module centralizes that parsing so scrape.py and the CSV-merge logic
don't have to duplicate regex handling.
"""
import re

_UNIT_MULTIPLIERS = {
    "RB": 1_000,
    "JT": 1_000_000,
}


def parse_price(text: str) -> int | None:
    """'Rp429.000' -> 429000. Returns None if no digits found."""
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    if not digits:
        return None
    return int(digits)


def parse_count(text: str) -> int | None:
    """Parses Shopee's abbreviated counts.

    Examples: '1RB+ Terjual' -> 1000, '3RB+' -> 3000, '565' -> 565,
    '1,7JT' -> 1700000, '2RB+' -> 2000.
    """
    if not text:
        return None
    text = text.strip().upper()
    match = re.search(r"([\d.,]+)\s*(RB|JT)?", text)
    if not match:
        return None
    number_part, unit = match.groups()
    number_part = number_part.replace(".", "").replace(",", ".")
    try:
        value = float(number_part)
    except ValueError:
        return None
    if unit:
        value *= _UNIT_MULTIPLIERS[unit]
    return int(value)


def parse_rating(text: str) -> float | None:
    """'4.9' or '4,9' -> 4.9"""
    if not text:
        return None
    match = re.search(r"[\d]+[.,]?\d*", text)
    if not match:
        return None
    return float(match.group(0).replace(",", "."))
