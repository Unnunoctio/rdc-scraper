import { PROXY_HOST, PROXY_PASS, PROXY_USER } from '../config'

export const curlFetch = async (url: string, headers: string[]): Promise<any> => {
  const curlArray = [
    'curl',
    '--silent',
    '--show-error',
    '--proxy',
    PROXY_HOST as string,
    '--proxy-user',
    `${PROXY_USER as string}:${PROXY_PASS as string}`,
    url
  ]

  for (const header of headers) {
    curlArray.push('-H', header)
  }

  console.log(curlArray)

  const proc = Bun.spawn(curlArray)
  const output = await new Response(proc.stdout).json()
  return output
}
