from abc import ABC

from boto3.session import Session

from config import AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY


class Dynamo(ABC):
    session: Session
    client: object

    def __init__(self):
        self.session = Session(
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )
        self.client = self.session.client("dynamodb")