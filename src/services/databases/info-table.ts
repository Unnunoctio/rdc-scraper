import { INFO_TABLE } from '@/config'
import { dynamodb } from '@/services/databases/dynamodb'
import type { Info } from '@/types'
import { generateInfoId } from '@/utils/nanoid'
import type { PutCommandInput, ScanCommandInput } from '@aws-sdk/lib-dynamodb'

const findInfo = async (info: Info): Promise<string | undefined> => {
  const params: ScanCommandInput = {
    TableName: INFO_TABLE,
    FilterExpression: 'begins_with(PK, :pk) AND SK = :metadata AND entity = :entity AND #name = :name',
    ExpressionAttributeValues: {
      ':pk': 'INFO#',
      ':metadata': 'METADATA',
      ':entity': 'INFO',
      ':name': info.name
    },
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ProjectionExpression: 'PK'
  }

  const infos: Array<{ PK: string }> | undefined = await dynamodb.scanItems(params)

  if (infos === undefined) return undefined
  if (infos.length !== 0) return infos[0].PK
  return await saveInfo(info)
}

const saveInfo = async (info: Info): Promise<string | undefined> => {
  const infoId = generateInfoId()

  const params: PutCommandInput = {
    TableName: INFO_TABLE,
    Item: {
      PK: `INFO#${infoId}`,
      SK: 'METADATA',
      entity: 'INFO',
      name: info.name,
      logo: info.logo
    },
    ConditionExpression: 'attribute_not_exists(PK)'
  }

  const isSaved = await dynamodb.PutItem(params)
  if (isSaved) return `INFO#${infoId}`
  return undefined
}

export const infoTable = {
  findInfo
}
