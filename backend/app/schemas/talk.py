from typing import Literal

from pydantic import BaseModel, Field


class RecentMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=1000)


class TalkRequest(BaseModel):
    """`recent` is kept by the client only; the server never stores conversations."""

    message: str = Field(min_length=1, max_length=1000)
    recent: list[RecentMessage] = Field(default_factory=list, max_length=6)
