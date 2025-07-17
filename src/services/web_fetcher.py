import asyncio
import json
from typing import Optional

from aiohttp import ClientSession, ClientTimeout, TCPConnector
from playwright.async_api import BrowserContext, async_playwright

from utils.logger import Logger
from utils.user_agent import get_random_user_agent


class WebFetcher:
    def __init__(self, max_retries: int = 3, delay: int = 5, max_concurrent: int = 10, timeout: int = 30) -> None:
        self.MAX_RETRIES = max_retries
        self.DELAY = delay
        self.MAX_CONCURRENT = max_concurrent
        self.TIMEOUT = timeout

        self._session = None
        self._playwright = None
        self._browser = None
        self._context = None

    async def _get_session(self) -> ClientSession:
        """Obtener o Crear una sesión de aiohttp"""
        if self._session is None or self._session.closed:
            connector = TCPConnector(limit=100, limit_per_host=self.MAX_CONCURRENT)
            timeout = ClientTimeout(total=self.TIMEOUT)
            headers = {"User-Agent": get_random_user_agent()}
            self._session = ClientSession(
                connector=connector, timeout=timeout, headers=headers
            )

        return self._session

    async def _get_browser_context(self) -> BrowserContext:
        """Obtener o Crear un contexto del navegador"""
        if self._playwright is None:
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
            self._context = await self._browser.new_context(
                user_agent=get_random_user_agent(),
                viewport={"width": 1920, "height": 1080},
            )

        return self._context

    async def fetch_html(self, url: str, **kwargs) -> Optional[str]:
        """Obtener HTML plano de una pagina de forma asíncrona"""
        for attempt in range(self.MAX_RETRIES):
            try:
                session = await self._get_session()

                async with session.get(url, **kwargs) as response:
                    if response.status == 200:
                        html = await response.text()
                        return html
                    else:
                        Logger.error(
                            "NETWORK", f"HTTP {response.status}: {response.reason}"
                        )
            except Exception as e:
                Logger.error("NETWORK", f"Error al obtener HTML: {e}")

            if attempt < self.MAX_RETRIES - 1:
                await asyncio.sleep(self.DELAY)

        return None

    async def fetch_api(self, url: str, **kwargs) -> Optional[dict]:
        """Obtener JSON plano de una API de forma asíncrona"""
        for attempt in range(self.MAX_RETRIES):
            try:
                session = await self._get_session()

                async with session.get(url, **kwargs) as response:
                    if response.status == 200:
                        try:
                            json_data = await response.json()
                            return json_data
                        except json.JSONDecodeError as e:
                            Logger.error("SYSTEM", f"Error al decodificar JSON: {e}")
                    else:
                        Logger.error(
                            "NETWORK", f"HTTP {response.status}: {response.reason}"
                        )
            except Exception as e:
                Logger.error("NETWORK", f"Error al obtener HTML: {e}")

            if attempt < self.MAX_RETRIES - 1:
                await asyncio.sleep(self.DELAY)

        return None

    async def fetch_html_with_browser(self, url: str) -> Optional[str]:
        """Obtener HTML con un navegador de forma asíncrona"""
        for attempt in range(self.MAX_RETRIES):
            try:
                context = await self._get_browser_context()
                page = await context.new_page()

                # Set timeout
                page.set_default_timeout(self.TIMEOUT * 1000)

                # Go to the URL
                await page.goto(url, wait_until="networkidle")

                # Get the HTML content
                html = await page.content()
                await page.close()

                return html
            except Exception as e:
                Logger.error("NETWORK", f"Error al obtener HTML: {e}")

                # Close the page if it's open
                try:
                    if "page" in locals():
                        await page.close()
                except:  # noqa: E722
                    pass

            if attempt < self.MAX_RETRIES - 1:
                await asyncio.sleep(self.DELAY)

        return None

    async def close(self):
        """Cerrar sesiones y recursos"""
        if self._session and not self._session.closed:
            await self._session.close()

        if self._context:
            await self._context.close()

        if self._browser:
            await self._browser.close()

        if self._playwright:
            await self._playwright.stop()

    async def __aenter__(self):
        """ "Context manager async entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """ "Context manager async exit"""
        await self.close()
