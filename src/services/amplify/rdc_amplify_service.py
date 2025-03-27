from config import AMPLIFY_APP_BRANCH, AMPLIFY_APP_ID
from services.amplify.amplify import Amplify


class RDCAmplifyService(Amplify):
    def redeploy_app(self) -> None:
        self.client.start_job(
            appId=AMPLIFY_APP_ID,
            branchName=AMPLIFY_APP_BRANCH,
            jobType="RELEASE"
        )


