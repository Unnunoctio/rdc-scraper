import unicodedata

from nanoid import generate

ALPHABET_HEX = "0123456789abcdef"
ALPHABET_DEC = "0123456789"

def generate_info_id():
    return generate(alphabet=ALPHABET_HEX, size=8)

def generate_product_sku():
    return generate(alphabet=ALPHABET_DEC, size=8)

def generate_website_id():
    return generate(alphabet=ALPHABET_HEX, size=16)

def generate_price_log_id():
    return generate(alphabet=ALPHABET_HEX, size=32)

def generate_id():
    return generate(alphabet=ALPHABET_HEX, size=16)

def generate_watcher():
    return generate(alphabet=ALPHABET_DEC, size=16)

def generate_title(drink: dict, quantity: int, is_url: bool = False) -> str:
    title = ""
    if quantity > 1:
        title += f"Pack {quantity} un. "

    if (drink["category"] == "Cervezas"):
        title += "Cerveza "
    elif (drink["category"] == "Destilados" or drink["category"] == "Vinos"):
        title += f"{drink['subCategory']} "

    title += f"{drink['brand']} {drink['name']} {drink['packaging']} "
    if is_url is False:
        title += f"{drink['abv']}° "

    if drink["volume"] >= 1000:
        title += f"{(drink['volume']/1000):.2f}L"
    else:
        title += f"{drink['volume']}cc"

    return title

def generate_slug(drink: dict, quantity: int, sku: str) -> str:
    title = generate_title(drink=drink, quantity=quantity, is_url=True)
    slug_title = (title.lower().replace("°", "").replace("+", "").replace(". ", "-").replace(".", "-").replace(" ", "-"))
    slug_title = unicodedata.normalize("NFD", slug_title).encode("ascii", "ignore").decode("utf-8")
    return f"{sku}-{slug_title}"