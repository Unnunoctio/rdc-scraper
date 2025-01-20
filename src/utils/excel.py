import os
import traceback
from itertools import groupby

from openpyxl import Workbook

from classes.new_product import NewProduct


def transform_brand(product: NewProduct) -> str:
    brand = product.brand
    return brand.lower().replace(" ", "-").replace("/", "-") if brand else ""


def create_excel(products: list[NewProduct], title: str) -> str:
    filename = f"{title}.xlsx"
    wb = Workbook()

    ws = wb.active
    ws.title = "Template"
    ws.append(["website", "url", "title", "brand", "price", "best_price", "image", "average", "abv", "volume", "quantity", "packaging"])

    products_by_brand = {}

    sorted_products = sorted(products, key=transform_brand)
    for brand, group in groupby(sorted_products, key=transform_brand):
        products_by_brand[brand] = list(group)


    for brand, products in products_by_brand.items():
        ws = wb.create_sheet(title=brand)
        ws.append(["website", "url", "title", "brand", "price", "best_price", "image", "average", "abv", "volume", "quantity", "packaging"])
        for product in products:
            ws.append([product.website, product.url, product.title, product.brand, product.price, product.best_price, product.image, product.average, product.abv, product.volume, product.quantity, product.packaging])
    
    wb.save(filename=filename)
    return filename


def delete_excel(filename: str) -> None:
    try:
        if os.path.exists(filename):
            os.remove(filename)
        else:
            print(f"File {filename} not found")
    except Exception:
        print("Error deleting excel")
        traceback.print_exc()