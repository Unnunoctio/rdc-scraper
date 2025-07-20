import asyncio

from services.web_fetcher import WebFetcher

# URL = "https://cervezasdelmundo.cl/tienda/cerveza-erdinger-brauhaus-helles-lagerbier-botella-500ml/"
URL = "https://www.lider.cl/supermercado/category/La_Boti/Cervezas"


async def main():
    async with WebFetcher() as fetcher:
        # html = await fetcher.fetch_html(URL)
        html = await fetcher.fetch_html_with_browser(URL)
        print(html)


if __name__ == "__main__":
    asyncio.run(main())
