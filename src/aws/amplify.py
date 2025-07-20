from boto3.session import Session

from config import AMPLIFY_APP_BRANCH, AMPLIFY_APP_ID, AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY
from utils.logger import Logger


class Amplify:
    def __init__(self) -> None:
        try:
            self.session = Session(
                region_name=AWS_REGION,
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            )
            try:
                self.client = self.session.client("amplify")
            except Exception as e:
                Logger.error("AUTH", "Error creating a Amplify client in AWS:", e)
        except Exception as e:
            Logger.error("AUTH", "Error creating a session in AWS:", e)

    def redeploy_app(self) -> None:
        try:
            self.client.start_job(
                appId=AMPLIFY_APP_ID,
                branchName=AMPLIFY_APP_BRANCH,
                jobType="RELEASE",
            )
        except Exception as e:
            Logger.error("ERROR", "Error redeploy app in Amplify:", e)
