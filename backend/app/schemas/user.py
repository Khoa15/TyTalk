from typing import Any

from pydantic import BaseModel


class MeOut(BaseModel):
    id: int
    email: str
    display_name: str
    traits: dict[str, Any]
