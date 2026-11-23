"""Chunk local PDF/code/text sources and insert embeddings into Supabase."""
import os
import sys
from pathlib import Path

import requests


def extract(path: Path):
    if path.suffix.lower() == ".pdf":
        from pypdf import PdfReader
        for page_no, page in enumerate(PdfReader(str(path)).pages, 1):
            yield page_no, page.extract_text() or ""
    else:
        yield None, path.read_text(encoding="utf-8", errors="replace")


def chunks(text, size=2600, overlap=300):
    text = " ".join(text.split())
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            boundary = text.rfind(" ", start + size // 2, end)
            if boundary > start:
                end = boundary
        part = text[start:end].strip()
        if len(part) >= 80:
            yield part
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)


def main(paths):
    base = os.environ["SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    openai_key = os.environ["OPENAI_API_KEY"]
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}", "Content-Type": "application/json", "Prefer": "return=minimal"}
    session = requests.Session()
    for raw in paths:
        path = Path(raw)
        kind = "rapor" if path.suffix.lower() == ".pdf" else ("kod" if path.suffix.lower() in {".py", ".js", ".ts", ".html", ".css", ".ino", ".cs"} else "kaynak")
        rows = []
        for page_no, text in extract(path):
            for part in chunks(text):
                rows.append({"content": part, "source": path.name, "page": page_no, "kind": kind})
        for offset in range(0, len(rows), 64):
            batch = rows[offset:offset + 64]
            response = session.post("https://api.openai.com/v1/embeddings", headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}, json={"model": "text-embedding-3-small", "input": [r["content"] for r in batch]}, timeout=90)
            response.raise_for_status()
            for row, vector in zip(batch, response.json()["data"]):
                row["embedding"] = vector["embedding"]
            saved = session.post(f"{base}/rest/v1/chunks", headers=headers, json=batch, timeout=90)
            saved.raise_for_status()
        print(f"{path}: {len(rows)} parça yüklendi")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Kullanım: python tools/ingest.py rapor.pdf posture_mediapipe.py")
    main(sys.argv[1:])
