import json, os, re, threading, hashlib, mimetypes
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from mfc_api import MFCClient, CollectionStatus, urls
from mfc_api import exceptions as E

MFCError = E.MFCError
MFCBlockedError = E.MFCBlockedError
MFCNotFoundError = E.MFCNotFoundError
MFCTransportError = E.MFCTransportError
MFCRateLimitedError = getattr(E, "MFCRateLimitedError", type("MFCRateLimitedError", (MFCError,), {}))

HERE = Path(__file__).parent
IMG_CACHE = HERE / ".img-cache"
IMG_CACHE.mkdir(exist_ok=True)
PORT = int(os.environ.get("PORT", 3000))
MAX_PAGES = 40
LOCK = threading.Lock()
PROFILES = ["chrome", "edge", "safari", "firefox"]
_clients = {}
_idx = 0


def client_for(i):
    if i not in _clients:
        _clients[i] = MFCClient(impersonate=PROFILES[i])
    return _clients[i]


def get_client():
    return client_for(_idx)


def big(url):
    return url.replace("/upload/items/0/", "/upload/items/1/") if url else url


def collect(user, mfc):
    out = {}
    for key, status in (("owned", CollectionStatus.OWNED), ("wished", CollectionStatus.WISHED), ("ordered", CollectionStatus.ORDERED)):
        items = {}
        for page in mfc.iter_collection(user, status=status, max_pages=MAX_PAGES):
            for it in page.items:
                items.setdefault(str(it.id), {"id": str(it.id), "name": it.name, "image": big(it.thumbnail) or ""})
        out[key] = list(items.values())
    return out


def err(code, msg):
    return code, json.dumps({"error": msg}).encode(), "application/json"


def is_blocked(e):
    return isinstance(e, MFCBlockedError) or "403" in str(e)


def diagnose(user):
    """Re-request the page once and describe what MFC/Cloudflare actually answered."""
    try:
        t = get_client().transport
        t.limiter.wait()
        r = t._session.get(urls.collection(user, status=2, page=1), timeout=30)
        body = r.text
        low = body.lower()
        m = re.search(r"<title>(.*?)</title>", body, re.S | re.I)
        title = re.sub(r"\s+", " ", m.group(1)).strip()[:80] if m else "none"
    except Exception as e:
        return f"(could not inspect the response: {e})"
    if any(k in low for k in ("just a moment", "error 1020", "attention required", "cf-chl", "cloudflare")):
        why = "Cloudflare is blocking this connection. Turn off any VPN or proxy, use your home network, and wait a few minutes before retrying."
    elif "private" in low:
        why = "MFC says this collection is private. Make it public in your MFC privacy settings."
    else:
        why = "MFC refused the request."
    return f"{why} [HTTP {r.status_code}, page title: {title}]"


def attempt(user):
    """Collect with the current browser profile; on a 403 try the next profiles."""
    global _idx
    last = None
    for k in range(len(PROFILES)):
        i = (_idx + k) % len(PROFILES)
        try:
            with LOCK:
                data = collect(user, client_for(i))
            _idx = i
            return data
        except MFCNotFoundError:
            raise
        except MFCError as e:
            if not is_blocked(e):
                raise
            last = e
        except Exception as e:
            last = e
    raise last


def api_mfc(user):
    if not re.fullmatch(r"[\w.\-]{1,40}", user or ""):
        return err(400, "Invalid username.")
    try:
        data = attempt(user)
    except MFCNotFoundError:
        return err(404, "MFC user not found. Check the username.")
    except MFCRateLimitedError as e:
        return err(429, f"MFC asked us to slow down. Try again in {int(getattr(e, 'retry_after', 60) or 60)} seconds.")
    except MFCError as e:
        if is_blocked(e):
            with LOCK:
                return err(502, diagnose(user))
        return err(502, f"MFC error: {e}")
    except Exception as e:
        return err(500, f"Unexpected error: {e}")
    if not any(data.values()):
        return err(404, "Nothing found. Make sure your collection, wishlist and orders are public on MFC.")
    return 200, json.dumps(data).encode(), "application/json"


def fetch_bytes(url):
    t = get_client().transport
    if hasattr(t, "get_bytes"):
        return t.get_bytes(url)
    t.limiter.wait()
    r = t._session.get(url, timeout=t.timeout)
    if r.status_code != 200:
        raise MFCError(f"Picture request returned HTTP {r.status_code}")
    return r.content


def api_img(url):
    u = urlparse(url or "")
    if u.scheme != "https" or u.hostname != "static.myfigurecollection.net":
        return err(403, "Only MFC pictures can be proxied.")
    f = IMG_CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".bin")
    if not f.exists():
        try:
            with LOCK:
                f.write_bytes(fetch_bytes(url))
        except MFCError as e:
            return err(502, str(e))
        except Exception as e:
            return err(502, f"Could not fetch picture: {e}")
    ctype = "image/png" if url.lower().endswith(".png") else "image/jpeg"
    return 200, f.read_bytes(), ctype


def serve_static(path):
    rel = path.lstrip("/") or "index.html"
    f = (HERE / rel).resolve()
    try:
        f.relative_to(HERE.resolve())
    except ValueError:
        return err(403, "Forbidden.")
    if not f.is_file():
        return err(404, "Not found.")
    ext = f.suffix.lower()
    ctype = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
    }.get(ext) or mimetypes.guess_type(str(f))[0] or "application/octet-stream"
    return 200, f.read_bytes(), ctype


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/api/mfc":
            code, body, ct = api_mfc(q.get("user", [""])[0])
        elif u.path == "/api/img":
            code, body, ct = api_img(q.get("url", [""])[0])
        else:
            code, body, ct = serve_static(u.path)
        self.send_response(code)
        self.send_header("Content-Type", ct)
        if u.path == "/api/img" and code == 200:
            self.send_header("Cache-Control", "public, max-age=86400")
        elif code == 200 and u.path != "/" and not u.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"MyFigureRoom on http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
