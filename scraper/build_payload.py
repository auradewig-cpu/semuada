"""Builds the JSON payload for POST /api/products (app/api/products/route.ts)
from a scraped product -- the API-contract counterpart to scrape.py's
build_output_row(), which targets the CSV/Import format instead.

Field names here must match what app/api/products/route.ts reads from
`body` (commission, image_urls as an array, etc.) -- NOT the CSV column
names used elsewhere in this scraper.
"""
from parsers import parse_price


def build_api_payload(csv_row: dict, scraped: dict) -> dict:
    product_name = scraped.get("product_name") or csv_row.get("Nama Produk", "").strip()
    commission = parse_price(csv_row.get("Komisi", ""))
    gallery = scraped.get("image_urls") or []

    return {
        "product_id": csv_row.get("ID Produk", "").strip(),
        "product_name": product_name,
        "price": scraped.get("price") or 0,
        "sales": scraped.get("sales") or 0,
        "category": scraped.get("category") or "Lainnya",
        "subcategory": scraped.get("subcategory") or "",
        "item": scraped.get("item") or "",
        "affiliate_url": csv_row.get("Link Komisi Ekstra", "").strip(),
        "image_url": gallery[0] if gallery else "",
        "image_urls": gallery[1:5],
        "video_url": "",
        "dikirim_dari": scraped.get("dikirim_dari") or "",
        "toko": csv_row.get("Nama Toko", "").strip(),
        "commission": commission or 0,
        "is_featured": False,
        "rating": scraped.get("rating") or 0,
        "stock_available": True,
    }
