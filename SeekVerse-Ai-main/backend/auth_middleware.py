"""Auth0 JWT verification middleware for FastAPI."""
import os
import json
import datetime
import urllib.request
from functools import lru_cache
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_API_AUDIENCE", "")
ALGORITHMS = ["RS256"]


@lru_cache(maxsize=1)
def _get_jwks():
    """Fetch and cache Auth0 JWKS (public keys for token verification)."""
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read())


def _verify_token(token: str) -> dict:
    """Verify an Auth0 JWT or local development token and return the payload."""
    # 1. Local / offline token support
    if token.startswith("local_"):
        try:
            import base64
            raw = token[len("local_"):]
            pad = len(raw) % 4
            if pad:
                raw += "=" * (4 - pad)
            decoded_bytes = base64.urlsafe_b64decode(raw.encode("utf-8"))
            payload = json.loads(decoded_bytes.decode("utf-8"))
            return {
                "sub": payload.get("sub") or f"local|{payload.get('email', 'default_user')}",
                "email": payload.get("email", "researcher@seekverse.ai"),
                "name": payload.get("name", "SeekVerse Researcher"),
                "picture": payload.get("picture", ""),
            }
        except Exception:
            return {
                "sub": f"local|{token[:32]}",
                "email": "researcher@seekverse.ai",
                "name": "SeekVerse Researcher",
                "picture": "",
            }

    # 2. If Auth0 domain is not configured or placeholder, accept unverified token
    if not AUTH0_DOMAIN or "placeholder" in AUTH0_DOMAIN:
        try:
            return jwt.get_unverified_claims(token)
        except Exception:
            return {
                "sub": f"local|{token[:32]}",
                "email": "researcher@seekverse.ai",
                "name": "SeekVerse Researcher",
                "picture": "",
            }

    # 3. Real Auth0 verification
    try:
        jwks = _get_jwks()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to reach Auth0 JWKS: {str(e)}")

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token header")

    rsa_key = {}
    for key in jwks.get("keys", []):
        if key["kid"] == unverified_header.get("kid"):
            rsa_key = {k: key[k] for k in ("kty", "kid", "use", "n", "e")}
            break

    if not rsa_key:
        raise HTTPException(status_code=401, detail="Unable to find signing key")

    try:
        payload = jwt.decode(
            token, rsa_key, algorithms=ALGORITHMS,
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTClaimsError:
        raise HTTPException(status_code=401, detail="Invalid claims")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token verification failed")


def _upsert_user(db: Session, payload: dict) -> User:
    """Get or create user from Auth0 JWT payload."""
    auth0_sub = payload.get("sub", "")
    if not auth0_sub:
        auth0_sub = f"local|{payload.get('email', 'guest')}"
    user = db.query(User).filter(User.auth0_sub == auth0_sub).first()
    if user:
        user.last_login = datetime.datetime.utcnow()
        if payload.get("name") and not user.display_name:
            user.display_name = payload.get("name")
        if payload.get("email") and not user.email:
            user.email = payload.get("email")
        db.commit()
        return user
    # First login — create user
    user = User(
        auth0_sub=auth0_sub,
        email=payload.get("email") or payload.get(f"https://{AUTH0_DOMAIN}/email", "") or "researcher@seekverse.ai",
        display_name=payload.get("name") or "SeekVerse Researcher",
        avatar_url=payload.get("picture", ""),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    """FastAPI dependency — REQUIRES auth. Raises 401 if not logged in."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    payload = _verify_token(token)
    return _upsert_user(db, payload)


def get_optional_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    """FastAPI dependency — optional auth. Returns None if not logged in."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1]
        payload = _verify_token(token)
        return _upsert_user(db, payload)
    except Exception:
        return None
