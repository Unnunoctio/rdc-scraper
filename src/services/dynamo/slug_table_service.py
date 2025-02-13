
from config import SLUG_TABLE
from services.dynamo.dynamo import Dynamo


class SlugTableService(Dynamo):
    def save_slugs(self, slug_products: list[dict]) -> None:
        save_count = 0
        for slug_product in slug_products:
            try:
                self.client.put_item(
                    TableName=SLUG_TABLE,
                    Item={
                        "PK": {'S': slug_product["slug"]},
                        "title": {'S': slug_product["title"]}
                    },
                    ConditionExpression="attribute_not_exists(PK)"
                )
                save_count += 1
            except Exception:
                continue
        
        print(f"Saved {save_count} new slugs")