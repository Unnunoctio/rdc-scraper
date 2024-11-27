import { DynamoDBClient, type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, ScanCommand, type PutCommandInput, type ScanCommandInput } from '@aws-sdk/lib-dynamodb'
import { AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY } from '@/config'

const AWS_CONFIG: DynamoDBClientConfig = {
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID as string,
    secretAccessKey: AWS_SECRET_ACCESS_KEY as string
  }
}

const getClient = (): DynamoDBDocumentClient => {
  const client = new DynamoDBClient(AWS_CONFIG)
  const docClient = DynamoDBDocumentClient.from(client)
  return docClient
}

const scanItems = async (params: ScanCommandInput): Promise<any[] | undefined> => {
  try {
    const client = getClient()
    const command = new ScanCommand(params)

    const { Items } = await client.send(command)
    return Items
  } catch (error) {
    console.error('Error scanning items', error)
    return undefined
  }
}

const PutItem = async (params: PutCommandInput): Promise<boolean> => {
  try {
    const client = getClient()
    const command = new PutCommand(params)

    await client.send(command)
    return true
  } catch (error) {
    console.error('Error putting item', error)
    return false
  }
}

export const dynamodb = {
  scanItems,
  PutItem
}
