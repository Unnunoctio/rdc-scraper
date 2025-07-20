import os

from dotenv import load_dotenv

from utils.logger import Logger

load_dotenv()


def get_env(key: str) -> str:
    """Obtener valor de la variable de entorno"""
    env = os.getenv(key)
    if env is None:
        Logger.critical("ENV_KEY", "No environment variable found for: " + key)
        # exit(1)
    return env


# Set up the APP Environment
# DEV | PROD
ENVIRONMENT = get_env("ENVIRONMENT")

# Set up the AWS environment variables
AWS_REGION = get_env("AWS_REGION")
AWS_ACCESS_KEY_ID = get_env("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = get_env("AWS_SECRET_ACCESS_KEY")

# Set up the AWS Services
IMAGES_BUCKET = get_env("IMAGES_BUCKET")
AMPLIFY_APP_ID = get_env("AMPLIFY_APP_ID")
AMPLIFY_APP_BRANCH = get_env("AMPLIFY_APP_BRANCH")

# Set up the Database Connection
MONGO_URI = get_env("MONGO_URI")
MONGO_DB = get_env("MONGO_DB")

# Set up the Drinks API
DRINKS_API_URL = get_env("DRINKS_API_URL")

# Set up the Email Service
RESEND_API_KEY = get_env("RESEND_API_KEY")
RESEND_SEND = get_env("RESEND_SEND")
