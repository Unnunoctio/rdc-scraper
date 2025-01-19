import traceback

from pymongo.collection import Collection

from services.s3.image_bucket_service import ImageBucketService
from services.mongodb.mongodb import MongoDB
from utils.generate import generate_id


class ImageTableService():
    collection: Collection
    image_s3_service: ImageBucketService

    def __init__(self, mongodb_connection: MongoDB):
        collection_name = "images"

        collection_list = mongodb_connection.database.list_collection_names()
        if collection_name not in collection_list:
            mongodb_connection.database.create_collection(collection_name)

        self.collection = mongodb_connection.database[collection_name]
        self.image_s3_service = ImageBucketService()

    def save_image(self, image_url: str, category: str, brand: str, sku: str) -> str | None:
        try:
            image = self.image_s3_service.upload_images(image_url=image_url, category=category, brand=brand, sku=sku)

            res = self.collection.insert_one({
                "_id": generate_id(),
                "small": image["small"],
                "large": image["large"],
                "original": image["original"]
            })
            return res.inserted_id
        except Exception:
            print("Error while saving image")
            traceback.print_exc()
            return None