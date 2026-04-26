import json
from abc import ABC, abstractmethod
from typing import Any, Optional

from aiohttp import ClientSession


class IFetcher(ABC):
    @abstractmethod
    async def fetch(self, session: ClientSession, url: str, **kwargs) -> Any:
        pass


class JsonFetcher(IFetcher):
    async def fetch(
        self,
        session: ClientSession,
        url: str,
        headers: dict = {},
        method: str = "GET",
        body: Optional[dict] = None,
        **kwargs,
    ) -> Optional[dict]:
        try:
            if method.upper() == "POST" or body is not None:
                async with session.post(url, json=body, headers=headers) as response:
                    if response.status != 200:
                        print(f"[JsonFetcher] POST {url} -> HTTP {response.status} / Body: {body}")
                        return None
                    return await response.json()
            else:
                async with session.get(url, headers=headers) as response:
                    if response.status != 200:
                        print(f"[JsonFetcher] GET {url} -> HTTP {response.status}")
                        return None
                    return await response.json()
        except Exception as e:
            print(f"[JsonFetcher] Error fetching {url}: {e}")
            return None


class HtmlFetcher(IFetcher):
    async def fetch(self, session: ClientSession, url: str, headers: dict = {}, **kwargs) -> Optional[str]:
        try:
            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    print(f"[HtmlFetcher] {url} -> HTTP {response.status}")
                    return None
                return await response.text()
        except Exception as e:
            print(f"[HtmlFetcher] Error fetching {url}: {e}")
            return None


class ProxyFetcher(IFetcher):
    def __init__(self, proxy_endpoint: str, proxy_api_key: str):
        self.proxy_endpoint = proxy_endpoint
        self.proxy_api_key = proxy_api_key

    async def fetch(
        self,
        session: ClientSession,
        url: str,
        method: str = "GET",
        headers: dict = {},
        body: Optional[dict] = None,
        **kwargs,
    ) -> Optional[dict]:
        proxy_body: dict = {"url": url, "method": method, "headers": headers}
        if body:
            proxy_body["body"] = json.dumps(body)

        proxy_headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.proxy_api_key,
        }

        try:
            async with session.post(
                self.proxy_endpoint,
                data=json.dumps(proxy_body),
                headers=proxy_headers,
            ) as response:
                if response.status != 200:
                    print(f"[ProxyFetcher] {url} -> HTTP {response.status}")
                    return None
                data = await response.json()
                return data.get("data")
        except Exception as e:
            print(f"[ProxyFetcher] Error fetching {url}: {e}")
            return None
