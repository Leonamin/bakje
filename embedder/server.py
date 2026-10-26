"""Embedding sidecar.

POST /embed       {"texts": [...], "kind": "document"|"query"}  -> {"vectors": [[...]]}
POST /embed-image {"images": [<base64 jpeg/png/webp>, ...]}      -> {"vectors": [[...]]}

One model instance stays resident (about 3.6GB) and requests are serialised,
so concurrent callers cannot multiply the memory or CPU use.
"""
import base64
import io
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from PIL import Image
from sentence_transformers import SentenceTransformer

MODEL = os.environ.get("EMBED_MODEL", "google/embeddinggemma-2")
DIM = int(os.environ.get("EMBED_DIM", "256"))
MAX_TEXTS = 64
MAX_IMAGES = 8

torch.set_num_threads(int(os.environ.get("EMBED_THREADS", "8")))
# The audio encoder is never used, so skip loading it (saves about 1GB).
model = SentenceTransformer(
    MODEL, device="cpu", model_kwargs={"dtype": torch.float32}, config_kwargs={"audio_config": None}
)
lock = threading.Lock()
PROMPTS = {"document": "Document", "query": "SearchQuery"}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"ok": True, "model": MODEL, "dim": DIM})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path not in ("/embed", "/embed-image"):
            return self._send(404, {"error": "not found"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
            if self.path == "/embed-image":
                return self._embed_images(body)
            texts, kind = body["texts"], body.get("kind", "document")
            assert isinstance(texts, list) and 0 < len(texts) <= MAX_TEXTS
            assert all(isinstance(t, str) for t in texts) and kind in PROMPTS
        except Exception:
            return self._send(400, {"error": "bad request"})
        with lock:
            vecs = model.encode(
                texts, prompt_name=PROMPTS[kind], normalize_embeddings=True, truncate_dim=DIM
            )
        self._send(200, {"vectors": vecs.tolist()})

    def _embed_images(self, body):
        try:
            raw = body["images"]
            assert isinstance(raw, list) and 0 < len(raw) <= MAX_IMAGES
            images = [Image.open(io.BytesIO(base64.b64decode(b))).convert("RGB") for b in raw]
        except Exception:
            return self._send(400, {"error": "bad request"})
        with lock:
            vecs = [
                model.encode(
                    {"text": "<|image|>", "image": [im]}, normalize_embeddings=True, truncate_dim=DIM
                )
                for im in images
            ]
        self._send(200, {"vectors": [v.tolist() for v in vecs]})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
