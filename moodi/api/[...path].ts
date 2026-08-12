type RuntimeEnvironment = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}

/**
 * Vercel에서 browser-facing `/api/*`를 backend로 전달하는 same-origin proxy다.
 *
 * 브라우저가 backend origin을 직접 호출하면 GIS double-submit cookie인
 * `g_csrf_token`과 host-only session cookie가 서로 다른 호스트에 저장된다.
 * 이 경계에서 요청 cookie와 응답 Set-Cookie를 그대로 전달해 브라우저와
 * backend가 같은 Vercel origin을 기준으로 인증 상태를 유지하게 한다.
 */
export default async function proxy(request: Request): Promise<Response> {
  const backendOrigin = getBackendOrigin()

  if (!backendOrigin) {
    return Response.json(
      {
        type: 'https://moodi.app/problems/internal-error',
        title: 'Backend proxy is not configured',
        status: 500,
        detail: 'MOODI_BACKEND_ORIGIN is not configured.',
      },
      { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
    )
  }

  const requestUrl = new URL(request.url)
  const upstreamUrl = new URL(
    `${requestUrl.pathname}${requestUrl.search}`,
    backendOrigin,
  )
  const headers = new Headers(request.headers)

  // Vercel must set the upstream Host and content length for the forwarded request.
  headers.delete('host')
  headers.delete('content-length')
  headers.delete('connection')

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const requestInit: RequestInit & { duplex?: 'half' } = {
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    headers,
    method: request.method,
    redirect: 'manual',
  }

  // Returning the upstream Response preserves status, streaming bodies, Location,
  // Set-Cookie, ETag, and SSE headers without exposing the backend origin to the browser.
  return fetch(upstreamUrl, requestInit)
}

function getBackendOrigin(): string | null {
  const environment = globalThis as RuntimeEnvironment
  const configuredOrigin = environment.process?.env?.MOODI_BACKEND_ORIGIN?.trim()

  if (!configuredOrigin) return null

  try {
    const origin = new URL(configuredOrigin)

    if (!['http:', 'https:'].includes(origin.protocol)) return null
    if (origin.username || origin.password || origin.search || origin.hash) return null

    return origin.origin
  } catch {
    return null
  }
}
