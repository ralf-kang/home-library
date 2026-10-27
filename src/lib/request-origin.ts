/**
 * 브라우저가 실제로 접속한 주소(origin). Edge·Node 양쪽에서 쓸 수 있다(의존성 없음).
 *
 * standalone 서버는 HOSTNAME=0.0.0.0 으로 떠 있어서 req.url 이 http://0.0.0.0:3000/… 이 된다.
 * 그 값으로 리디렉트하면 브라우저가 0.0.0.0:3000 으로 가 버리므로, Host(리버스 프록시 뒤면 X-Forwarded-Host)
 * 헤더로 공개 주소를 만든다.
 */
export function requestOrigin(req: Request): string {
  const h = req.headers
  const host = h.get('x-forwarded-host')?.split(',')[0].trim() || h.get('host')
  const url = new URL(req.url)
  const proto = h.get('x-forwarded-proto')?.split(',')[0].trim() || url.protocol.replace(':', '')
  return host ? `${proto}://${host}` : url.origin
}

/** 같은 사이트 안의 경로를 브라우저가 접속한 주소 기준 절대 URL 로. */
export function siteUrl(req: Request, path: string): URL {
  return new URL(path, requestOrigin(req))
}
