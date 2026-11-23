"""Securely ingest the curated MaternalAI source notes via the protected Edge Function."""
import getpass
import json
import urllib.request
from pathlib import Path

FUNCTION_URL = "https://rfflfvmgqybmavqsplai.supabase.co/functions/v1/maternalai-api"
PUBLISHABLE_KEY = "sb_publishable_wq5PcbWbgc_ao2nD68WUcA_4xmHP4gE"
SOURCE_DIR = Path(__file__).resolve().parents[2] / "maternalai-rag-sources"


def main():
    password = getpass.getpass("Sunumcu paneli parolası (girdi ekranda görünmez): ")
    files = sorted(SOURCE_DIR.glob("*.md"))
    for path in files:
        payload = json.dumps({"action": "ingest", "source": path.name, "content": path.read_text(encoding="utf-8")}).encode()
        request = urllib.request.Request(FUNCTION_URL, data=payload, headers={"apikey": PUBLISHABLE_KEY, "Content-Type": "application/json", "x-presenter-key": password}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result = json.loads(response.read().decode())
                print(f"{result.get('source')}: {'atlandı (zaten var)' if result.get('skipped') else str(result.get('chunks')) + ' parça yüklendi'}")
        except Exception as error:
            print(f"{path.name}: yükleme başarısız ({error})")
            raise


if __name__ == "__main__":
    main()


