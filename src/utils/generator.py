import unicodedata

from nanoid import generate

class Generator:
    ALPHABET_DEC = "0123456789"
    ALPHABET_HEX = "0123456789abcdef"
    ALPHABET_ALPHA = "abcdefghijklmnopqrstuvwxyz"

    @staticmethod
    def generate_hex_id(size: int = 8) -> str | None:
        """Generar ID con un alfabeto hexadecimal"""
        return generate(size=size, alphabet=Generator.ALPHABET_HEX)

    @staticmethod
    def generate_dec_id(size: int = 8) -> str | None:
        """Generar ID con un alfabeto decimal"""
        return generate(size=size, alphabet=Generator.ALPHABET_DEC)
    
    @staticmethod
    def generate_alpha_id(size: int = 8) -> str | None:
        """Generar ID con un alfabeto alfabético"""
        return generate(size=size, alphabet=Generator.ALPHABET_ALPHA)

    @staticmethod
    def generate_title(drink: dict, quantity: int, is_url: bool = False) -> str:
        """Generar título para el producto"""
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
            title += f"{(drink['volume']/1000):.2f}".rstrip('0').rstrip('.')  + "L"
        else:
            title += f"{drink['volume']}cc"

        return title

    @staticmethod
    def generate_slug(drink: dict, quantity: int, sku: str) -> str:
        """Generar slug para el producto"""
        title = Generator.generate_title(drink=drink, quantity=quantity, is_url=True)
        slug_title = (title.lower().replace("°", "").replace("+", "").replace(". ", "-").replace(".", "-").replace(" ", "-"))
        slug_title = unicodedata.normalize("NFD", slug_title).encode("ascii", "ignore").decode("utf-8")
        
        return f"{sku}-{slug_title}"