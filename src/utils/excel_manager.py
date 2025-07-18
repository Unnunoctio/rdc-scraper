from utils.logger import Logger
from openpyxl.worksheet._write_only import WriteOnlyWorksheet
import os
from itertools import groupby

from openpyxl import Workbook
from openpyxl.worksheet.worksheet import Worksheet

from classes.product import Product

class ExcelManager:
    @classmethod
    def _format_brand(cls, product: Product) -> str:
        """Formatear el nombre de la marca en una cadena de caracteres"""
        brand = product.brand
        return brand.lower().replace(" ", "-").replace("/", "-") if brand else "Other"

    @staticmethod
    def create(file_name: str, products: list[Product]) -> str:
        """Crear archivo excel con los datos de los productos"""
        wb = Workbook()

        # Headers
        ws_headers = ["Website", "URL", "Title", "Brand", "Price", "Best Price", "Image", "Average", "ABV", "Volume", "Quantity", "Packaging"]

        # Create template Sheet
        ws: Worksheet | WriteOnlyWorksheet = wb.active
        ws.title = "Template"
        ws.append(ws_headers)

        # Group products by brand
        products_by_brand: dict[str, list[Product]] = {}
        sorted_products = sorted(products, key=ExcelManager._format_brand)
        for brand, group in groupby(sorted_products, key=ExcelManager._format_brand):
            products_by_brand[brand] = list(group)

        # Create sheets for each brand
        for brand, products in products_by_brand.items():
            ws = wb.create_sheet(title=brand)
            ws.append(ws_headers)
            for p in products:
                ws.append([p.website, p.url, p.title, p.brand, p.price, p.best_price, p.image, p.average, p.abv, p.volume, p.quantity, p.packaging])

        # Save file
        wb.save(file_name)
        return file_name
    
    @staticmethod
    def delete(file_name: str) -> None:
        try:
            if os.path.exists(file_name):
                os.remove(file_name)
            else:
                Logger.warning("FILE", f"File {file_name} does not exist")
        except Exception as e:
            Logger.error("FILE", f"Error deleting file: {e}")
