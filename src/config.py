import os

from dotenv import load_dotenv

load_dotenv()

def get_env(key: str) -> str | None:
    env = os.getenv(key)
    return env if env != "" else None

AWS_REGION = get_env("AWS_REGION")
AWS_ACCESS_KEY_ID = get_env("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = get_env("AWS_SECRET_ACCESS_KEY")

DRINK_TABLE = get_env("DRINK_TABLE")
INFO_TABLE = get_env("INFO_TABLE")
PRODUCT_TABLE = get_env("PRODUCT_TABLE")
IMAGES_BUCKET = get_env("IMAGES_BUCKET")

DRINKS_API = get_env("DRINKS_API")

MONGO_URI = get_env("MONGO_URI")
MONGO_DB = get_env("MONGO_DB")

RESEND_KEY = get_env("RESEND_KEY")
RESEND_SEND = get_env("RESEND_SEND")