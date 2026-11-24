"""
Prepara os emuladores do Firebase para testar o playback no app (só local; nada vai para produção):
- usuário de teste no emulador de Auth;
- a música de teste "pop-em-c" (cifra escrita para os testes) no emulador do Firestore.

    firebase emulators:start --only auth,firestore,storage,functions
    python seed_emulator.py

Depois entre no app (com NEXT_PUBLIC_USE_FIREBASE_EMULATORS=1) com o usuário abaixo e abra
/lyric/lyric-show/teste-playback. O mp3 de teste é out/pop-reto.mp3 (gerado por bench.py).
"""
import json
import os
import urllib.request

PROJECT = os.environ.get("FIREBASE_PROJECT", "avid-bricolage-313721")
# Credenciais só do emulador local (não existem em produção).
TEST_EMAIL = "playback.teste@example.com"
TEST_PASSWORD = "emulador-123456"
TEST_NAME = "Teste Playback"
LYRIC_ID = "teste-playback"
HERE = os.path.dirname(__file__)


def call(url, body, headers=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()[:200]}


def fs_doc(collection, doc_id, fields):
    def val(v):
        if isinstance(v, str):
            return {"stringValue": v}
        if isinstance(v, bool):
            return {"booleanValue": v}
        if isinstance(v, int):
            return {"integerValue": str(v)}
        raise TypeError(v)
    url = (f"http://127.0.0.1:8080/v1/projects/{PROJECT}/databases/(default)/documents/"
           f"{collection}?documentId={doc_id}")
    return call(url, {"fields": {k: val(v) for k, v in fields.items()}}, {"Authorization": "Bearer owner"})


if __name__ == "__main__":
    u = call(f"http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake",
             {"email": TEST_EMAIL, "password": TEST_PASSWORD, "displayName": TEST_NAME, "returnSecureToken": True})
    print("usuário:", "criado" if "localId" in u else u.get("error", u))
    if "localId" in u:
        fs_doc("users", u["localId"], {"name": TEST_NAME, "email": TEST_EMAIL})
    fs_doc("composers", "teste-artista", {"composerName": "Artista de Teste"})
    lyric = open(os.path.join(HERE, "testdata", "pop-em-c.html"), encoding="utf-8").read()
    r = fs_doc("lyrics", LYRIC_ID, {
        "composerId": "teste-artista",
        "composerName": "Artista de Teste",
        "lyric": lyric,
        "lyricName": "Pop em C (teste)",
        "lyricStyle": "Pop",
        "originalTone": "C",
    })
    print("música:", "criada" if "name" in r else r.get("error", r))
