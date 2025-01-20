import traceback
import base64

import resend

from classes.new_product import NewProduct
from config import RESEND_KEY
from utils.excel import create_excel, delete_excel


def send_email(products: list[NewProduct]) -> None:
    beers_filename = create_excel(products=[product for product in products if product.category == "Cervezas"], title="not-found-beers")
    wines_filename = create_excel(products=[product for product in products if product.category == "Vinos"], title="not-found-wines")
    spirits_filename = create_excel(products=[product for product in products if product.category == "Destilados"], title="not-found-spirits")

    with open(beers_filename, "rb") as f:
        beers_file = base64.b64encode(f.read()).decode("utf-8")

    with open(wines_filename, "rb") as f:
        wines_file = base64.b64encode(f.read()).decode("utf-8")

    with open(spirits_filename, "rb") as f:
        spirits_file = base64.b64encode(f.read()).decode("utf-8")

    try:
        resend.api_key = RESEND_KEY

        params: resend.Emails.SendParams = {
            "from": "Scraping <onboarding@resend.dev>",
            "to": ["rincondelcurao@gmail.com"],
            "subject": "Scraping not found results",
            "html": "<h1>Products not found</h1>",
            "attachments": [
                {
                    "filename": beers_filename,
                    "content": beers_file,
                    "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                },
                {
                    "filename": wines_filename,
                    "content": wines_file,
                    "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                },
                {
                    "filename": spirits_filename,
                    "content": spirits_file,
                    "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                }
            ]
        }

        resend.Emails.send(params)
        print("Email sent")

        delete_excel(beers_filename)
        delete_excel(wines_filename)
        delete_excel(spirits_filename)
    except Exception:
        print("Error sending email")
        traceback.print_exc()