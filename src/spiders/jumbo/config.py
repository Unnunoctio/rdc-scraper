"""Config del spider Jumbo (constantes en código).

Antes vivía en el item de DynamoDB (`SpiderConfigsTable`); ahora es estática (ver PLAN §4).
El `info` de la tienda (code/name/logo/url) NO va aquí: es seed de `infos` (Fase 4).
"""

# Identificador de la tienda (= `source` de ScrapedProduct y llave del allowlist en `infos`).
SOURCE = "jumbo"

# Store name que exige la API de VTEX/BFF de Jumbo en los bodies.
STORE = "jumboclj512"

# Productos por página en la PLP.
PAGE_SIZE = 40

# Endpoints del BFF (POST).
PRODUCT_LIST_URL = "https://bff.jumbo.cl/catalog/plp"
PRODUCT_DETAILS_URL = "https://bff.jumbo.cl/catalog/pdp"

# Construcción de la URL pública del producto: prefix + slug + postfix.
PRODUCT_URL = {"prefix": "https://www.jumbo.cl/", "postfix": "/p"}

# Categorías a scrapear (valor de `selectedFacets[category2]`).
CATEGORY_URLS = [
    "/licores-bebidas-y-aguas/cervezas",
    "/licores-bebidas-y-aguas/destilados",
    "/licores-bebidas-y-aguas/vinos",
]

# Headers HTTP (la Apikey es pública del storefront; se versiona por decisión de PLAN §2.1).
HEADERS = {
    "Apikey": "be-reg-groceries-jumbo-catalog-w54byfvkmju5",
    "Content-Type": "application/json",
}
