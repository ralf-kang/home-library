import { describe, expect, it } from 'vitest'
import { requestOrigin, siteUrl } from '../src/lib/request-origin'

describe('리디렉트 기준 주소', () => {
  it('서버 바인드 주소(0.0.0.0:3000)가 아니라 브라우저가 접속한 Host 를 쓴다', () => {
    const req = new Request('http://0.0.0.0:3000/api/auth/dev', { headers: { host: '192.168.100.100:30503' } })
    expect(requestOrigin(req)).toBe('http://192.168.100.100:30503')
    expect(siteUrl(req, '/dashboard').toString()).toBe('http://192.168.100.100:30503/dashboard')
  })
  it('리버스 프록시 뒤면 X-Forwarded-Host/Proto 를 우선', () => {
    const req = new Request('http://0.0.0.0:3000/', {
      headers: { host: 'home-library:3000', 'x-forwarded-host': 'library.example.com', 'x-forwarded-proto': 'https' },
    })
    expect(requestOrigin(req)).toBe('https://library.example.com')
  })
})
