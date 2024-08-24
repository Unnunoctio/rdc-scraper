import { ENVIRONMENT, PROXY_HOST, PROXY_PASS, PROXY_USER } from '../config'

export const curlFetch = async (url: string, headers: string[]): Promise<any> => {
  if (ENVIRONMENT === 'DEVELOPMENT') {
    const headersObject = Object.fromEntries(headers.map(header => header.split(': ')))
    const res = await fetch(url, { headers: headersObject })
    return await res.json()
  }

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

  const proc = Bun.spawn(curlArray)
  const output = await new Response(proc.stdout).json()
  return output
}
