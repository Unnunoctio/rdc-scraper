from io import BytesIO

import requests
from boto3.session import Session
from PIL import Image

from config import AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, IMAGES_BUCKET
from utils.logger import Logger


class S3Bucket:
    def __init__(self) -> None:
        try:
            self.session = Session(
                region_name=AWS_REGION,
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            )
            try:
                self.client = self.session.client("s3")
            except Exception as e:
                Logger.error("AUTH", "Error creating a S3 client in AWS:", e)
        except Exception as e:
            Logger.error("AUTH", "Error creating a session in AWS:", e)

    def upload_image_file(self, image_url: str, file_name: str, size: tuple[int, int] = (1500, 1500)) -> str | None:
        try:
            response = requests.get(image_url)
            response.raise_for_status()

            image_buffer = BytesIO(response.content)

            with Image.open(image_buffer) as image:
                image.thumbnail(size, Image.Resampling.LANCZOS)

                output_buffer = BytesIO()
                image.save(output_buffer, format="WebP", quality=100, optimize=True)
                output_buffer.seek(0)

                self.client.upload_fileobj(
                    output_buffer,
                    IMAGES_BUCKET,
                    file_name,
                    ExtraArgs={
                        "ContentType": "image/webp",
                        "ACL": "public-read",
                    },
                )

                return f"https://{IMAGES_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{file_name}"
        except Exception as e:
            Logger.error("ERROR", "Error uploading image to S3:", e)
            return None

    def upload_images(self, image_url: str, category: str, brand: str, sku: str) -> dict[str, str]:
        folder_name = f"{category.lower()}/{brand.lower().replace('/', '-')}/{sku.lower()}".replace(" ", "-")

        small_image = self.upload_image_file(image_url=image_url, file_name=f"{folder_name}/{sku}-200.webp", size=(200, 200))
        large_image = self.upload_image_file(image_url=image_url, file_name=f"{folder_name}/{sku}-600.webp", size=(600, 600))
        original_image = self.upload_image_file(image_url=image_url, file_name=f"{folder_name}/{sku}.webp", size=(1500, 1500))

        return {
            "small": small_image,
            "large": large_image,
            "original": original_image,
        }
