from io import BytesIO

import requests
from PIL import Image

from config import AWS_REGION, IMAGES_BUCKET
from services.s3.s3 import S3


class ImageBucketService(S3):
    def upload_image(self, image_url: str, s3_key: str, size: tuple[float, float] = (1500, 1500)) -> str | None:
        try:
            res = requests.get(image_url)
            res.raise_for_status()

            image_buffer = BytesIO(res.content)

            with Image.open(image_buffer) as img:
                img.thumbnail(size, Image.Resampling.LANCZOS)

                output_buffer = BytesIO()
                img.save(output_buffer, format="WebP", quality=100, optimize=True)
                output_buffer.seek(0)

                self.client.upload_fileobj(
                    output_buffer,
                    IMAGES_BUCKET,
                    s3_key,
                    ExtraArgs = {
                        "ContentType": "image/webp",
                        "ACL": "public-read",
                    }
                )

                return f"https://{IMAGES_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
        except Exception as e:
            print(f"Error while uploading image: {e}")
            return None
        
    def upload_images(self, image_url: str, category: str, brand: str, sku: str) -> dict:
        folder = f"{category.lower()}/{brand.lower().replace("/", "-")}/{sku}"

        small_image = self.upload_image(image_url=image_url, s3_key=f"{folder.replace(" ", "-")}/{sku}-200.webp", size=(200, 200))
        large_image = self.upload_image(image_url=image_url, s3_key=f"{folder.replace(" ", "-")}/{sku}-600.webp", size=(600, 600))
        original_image = self.upload_image(image_url=image_url, s3_key=f"{folder.replace(" ", "-")}/{sku}.webp", size=(1500, 1500))

        return {
            "small": small_image,
            "large": large_image,
            "original": original_image
        }