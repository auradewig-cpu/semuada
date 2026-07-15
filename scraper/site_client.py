"""Thin HTTP client for the SEMUADA admin API, used by the local scraper
control panel to log in as admin and insert scraped products directly into
the live database (skipping the CSV/Import step).

Session/cookies are kept in-memory only (a requests.Session) -- nothing
touches disk, and the password is never logged.
"""
import requests


class SiteAuthError(Exception):
    pass


def login(session: requests.Session, base_url: str, username: str, password: str) -> None:
    """Replicates the NextAuth Credentials sign-in flow (same one verified
    manually via curl during development): fetch a CSRF token, then submit
    it with the credentials to get a session cookie."""
    csrf_res = session.get(f"{base_url}/api/auth/csrf", timeout=15)
    csrf_res.raise_for_status()
    csrf_token = csrf_res.json().get("csrfToken")
    if not csrf_token:
        raise SiteAuthError("Tidak bisa mengambil CSRF token dari situs.")

    login_res = session.post(
        f"{base_url}/api/auth/callback/credentials",
        data={
            "username": username,
            "password": password,
            "csrfToken": csrf_token,
            "json": "true",
        },
        timeout=15,
        allow_redirects=False,
    )
    if login_res.status_code not in (200, 302):
        raise SiteAuthError(f"Login gagal (HTTP {login_res.status_code}). Cek username/password.")

    # Verify the session actually took -- a bad login still redirects to
    # /admin/login?error=... with a 302, so check that we hold a real session.
    session_res = session.get(f"{base_url}/api/auth/session", timeout=15)
    session_res.raise_for_status()
    if not session_res.json():
        raise SiteAuthError("Login gagal -- periksa username/password admin.")


def get_existing_product_ids(session: requests.Session, base_url: str) -> set[str]:
    res = session.get(f"{base_url}/api/products/all", timeout=30)
    res.raise_for_status()
    return {p["product_id"] for p in res.json() if p.get("product_id")}


def create_product(session: requests.Session, base_url: str, payload: dict) -> dict:
    res = session.post(f"{base_url}/api/products", json=payload, timeout=30)
    if res.status_code >= 400:
        raise RuntimeError(f"Gagal simpan produk (HTTP {res.status_code}): {res.text[:300]}")
    return res.json()
