from fastapi import APIRouter

from app.api.v1 import auth, health, me, talk

# Every route under this router lives at /api/v1. A future v2 gets its own package and router.
api_v1 = APIRouter()
api_v1.include_router(health.router)
api_v1.include_router(auth.router)
api_v1.include_router(me.router)
api_v1.include_router(talk.router)
