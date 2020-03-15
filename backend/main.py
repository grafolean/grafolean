from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import CORS_DOMAINS


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_DOMAINS,
    allow_credentials=False,  # indicates that cookies should be supported for cross-origin requests
    allow_methods=['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allow_headers=['Content-Type', 'Authorization'],
    expose_headers=['X-JWT-Token'],
    max_age=3600,
)


@app.get("/accounts/{account_id}/values")
async def read_root(account_id: int):
    return {"Hello": "World2"}


@app.get("/items/{item_id}")
async def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}