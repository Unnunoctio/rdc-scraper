"""Conexión única a MongoDB Atlas, reutilizada entre invocaciones (container reuse).

El event loop y el `AsyncMongoClient` se crean una sola vez a nivel de módulo. El cliente se
liga al loop activo en su creación, por eso NO se usa `asyncio.run()` por invocación (crearía
un loop nuevo cada vez y rompería el cliente); en su lugar se reutiliza `_loop` vía `run()`.
"""

import asyncio
import os

from pymongo import AsyncMongoClient

MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB = os.environ["MONGODB_DB"]

_loop = asyncio.new_event_loop()
asyncio.set_event_loop(_loop)

_client = AsyncMongoClient(MONGODB_URI)


def run(coro):
    """Ejecuta una corrutina sobre el event loop persistente."""
    return _loop.run_until_complete(coro)


def get_db():
    return _client[MONGODB_DB]
