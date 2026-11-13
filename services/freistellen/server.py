"""Freistell-Server für Valet: BiRefNet General-dynamic (MIT) auf dem Prozessor.

POST /freistellen  Bild (JPEG/PNG/WebP) als Body, Header „Authorization: Bearer <Supabase-Sitzung>“
                   ->  PNG mit Transparenz, eng zugeschnitten
GET  /health        zum Aufwecken (lädt das Modell, falls noch nicht geschehen)

Zugang: nur angemeldete Valet-Nutzer, die Mitglied in einem Kleiderschrank sind (geprüft bei Supabase).
"""
import io, os, time, threading, json, urllib.request
import numpy as np, cv2, torch
from PIL import Image, ImageOps
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoModelForImageSegmentation

MODEL_DIR = os.environ.get('MODEL_DIR', '/model')
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://jocjisrmmzzvfnijosgg.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', 'sb_publishable_pByxxOf_ZahUWgiat-lXZQ_ynSsvUgZ')  # öffentlicher Schlüssel
ORIGINS = os.environ.get('ORIGINS', 'https://maxsbg.github.io,http://localhost:8081').split(',')
MAX_SIDE = int(os.environ.get('MAX_SIDE', '1024' if torch.cuda.is_available() else '768'))  # längste Seite beim Rechnen: 768 ≈ 4x schneller als 1024, kaum sichtbarer Unterschied
torch.set_num_threads(int(os.environ.get('THREADS', str(os.cpu_count() or 2))))
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'  # Grafikkarte (Modal) oder Prozessor (Space)
MEAN = np.array([0.485, 0.456, 0.406], np.float32); STD = np.array([0.229, 0.224, 0.225], np.float32)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=['GET', 'POST'], allow_headers=['authorization', 'content-type'], expose_headers=['x-dauer-ms'])
_ok_tokens: dict[str, float] = {}


def check_user(auth: str):
    """Supabase-Sitzung prüfen und ob der Nutzer Mitglied eines Kleiderschranks ist (5 Minuten gemerkt)."""
    if not auth.startswith('Bearer '):
        raise HTTPException(401, 'Nicht angemeldet')
    now = time.time()
    if _ok_tokens.get(auth, 0) > now:
        return
    def get(path):
        r = urllib.request.Request(SUPABASE_URL + path, headers={'apikey': SUPABASE_KEY, 'Authorization': auth})
        with urllib.request.urlopen(r, timeout=10) as res:
            return json.loads(res.read())
    try:
        get('/auth/v1/user')
        if not get('/rest/v1/wardrobes?select=id&limit=1'):
            raise HTTPException(403, 'Kein Kleiderschrank')
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, 'Nicht angemeldet')
    if len(_ok_tokens) > 1000:
        _ok_tokens.clear()
    _ok_tokens[auth] = now + 300
_model, _lock, _load_lock = None, threading.Lock(), threading.Lock()


def model():
    global _model
    with _load_lock:
        if _model is None:
            t = time.time()
            _model = AutoModelForImageSegmentation.from_pretrained(MODEL_DIR, trust_remote_code=True).float().eval().to(DEVICE)
            if DEVICE == 'cuda': _model.half()
            print(f'Modell geladen in {time.time() - t:.1f}s', flush=True)
    return _model


def refine_foreground(rgb: np.ndarray, a: np.ndarray, r: int = 90) -> np.ndarray:
    """Farbsaum an den Kanten entfernen (Blur-Fusion, wie in der BiRefNet-Demo)."""
    def est(F, B, r):
        blurred_a = cv2.blur(a, (r, r))[:, :, None]
        blurred_FA = cv2.blur(F * a[:, :, None], (r, r)); blurred_F = blurred_FA / (blurred_a + 1e-5)
        blurred_B1A = cv2.blur(B * (1 - a)[:, :, None], (r, r)); blurred_B = blurred_B1A / ((1 - blurred_a) + 1e-5)
        F = blurred_F + a[:, :, None] * (rgb - a[:, :, None] * blurred_F - (1 - a)[:, :, None] * blurred_B)
        return np.clip(F, 0, 1), blurred_B
    F, B = est(rgb, rgb, r)
    return est(F, B, 6)[0]


def cutout(img: Image.Image) -> Image.Image:
    img = ImageOps.exif_transpose(img).convert('RGB')
    rgb = np.asarray(img).astype(np.float32) / 255
    h, w = rgb.shape[:2]
    s = min(1.0, MAX_SIDE / max(h, w))
    rw, rh = max(32, int(w * s) // 32 * 32), max(32, int(h * s) // 32 * 32)  # dynamic: eigene Größe, Vielfaches von 32
    x = cv2.resize(rgb, (rw, rh), interpolation=cv2.INTER_AREA)
    x = ((x - MEAN) / STD).transpose(2, 0, 1)[None].astype(np.float32)
    with _lock, torch.inference_mode():
        t = torch.from_numpy(x).to(DEVICE)
        if DEVICE == 'cuda': t = t.half()
        m = model()(t)[-1].sigmoid()[0, 0].float().cpu().numpy()
    a = cv2.resize(m, (w, h), interpolation=cv2.INTER_LINEAR)
    fg = refine_foreground(rgb, a)
    ys, xs = np.where(a > 0.02)
    if not len(ys):
        raise HTTPException(422, 'Kein Motiv gefunden')
    out = np.dstack([fg, a])[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')


@app.get('/health')
def health():
    model()
    return {'ok': True, 'device': DEVICE}


@app.post('/freistellen')
async def freistellen(req: Request):
    check_user(req.headers.get('authorization', ''))
    body = await req.body()
    if not body or len(body) > 10 * 1024 * 1024:
        raise HTTPException(413, 'Bild leer oder größer als 10 MB')
    try:
        img = Image.open(io.BytesIO(body))
    except Exception:
        raise HTTPException(415, 'Kein lesbares Bild')
    t = time.time()
    out = cutout(img)
    buf = io.BytesIO(); out.save(buf, 'PNG', optimize=False, compress_level=3)
    return Response(buf.getvalue(), media_type='image/png', headers={'x-dauer-ms': str(int((time.time() - t) * 1000))})
