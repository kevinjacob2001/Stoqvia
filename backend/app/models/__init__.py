from typing import List

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    app: str
    env: str
    mongo: str
    database: str
    collections: List[str]
