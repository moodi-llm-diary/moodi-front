import { useCallback, useEffect, useState } from 'react'

export type DiaryRouteName =
  | 'home'
  | 'write'
  | 'ai'
  | 'entries'
  | 'entryDetail'
  | 'calendar'
  | 'insights'
  | 'tags'
  | 'settings'

export type DiaryLocation = {
  name: DiaryRouteName
  entryId?: string
}

type NavigateOptions = {
  replace?: boolean
}

/**
 * 별도 라우터 패키지 없이 Moodi의 고정 경로와 브라우저 history를 연결한다.
 */
export function useDiaryRoute() {
  const [location, setLocation] = useState<DiaryLocation>(() => parseDiaryLocation())

  useEffect(() => {
    const handlePopState = () => setLocation(parseDiaryLocation())

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback(
    (nextLocation: DiaryLocation, options: NavigateOptions = {}) => {
      const nextPath = getDiaryRoutePath(nextLocation)
      const currentPath = `${window.location.pathname}${window.location.search}`

      if (currentPath !== nextPath) {
        if (options.replace) {
          window.history.replaceState({}, '', nextPath)
        } else {
          window.history.pushState({}, '', nextPath)
        }
      }

      setLocation(nextLocation)
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
    },
    [],
  )

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    navigate({ name: 'home' }, { replace: true })
  }, [navigate])

  return { location, navigate, goBack }
}

/** Moodi route 상태를 실제 URL path로 변환한다. */
export function getDiaryRoutePath(location: DiaryLocation): string {
  switch (location.name) {
    case 'home':
      return '/'
    case 'write':
      return location.entryId
        ? `/write?entry=${encodeURIComponent(location.entryId)}`
        : '/write'
    case 'ai':
      return '/ai'
    case 'entries':
      return '/entries'
    case 'entryDetail':
      return location.entryId
        ? `/entries/${encodeURIComponent(location.entryId)}`
        : '/entries'
    case 'calendar':
      return '/calendar'
    case 'insights':
      return '/insights'
    case 'tags':
      return '/tags'
    case 'settings':
      return '/settings'
  }
}

function parseDiaryLocation(): DiaryLocation {
  const normalizedPath = normalizePathname(window.location.pathname)
  const searchParams = new URLSearchParams(window.location.search)

  if (normalizedPath === '/') {
    return { name: 'home' }
  }

  if (normalizedPath === '/write') {
    return { name: 'write', entryId: searchParams.get('entry') ?? undefined }
  }

  if (normalizedPath === '/ai') {
    return { name: 'ai' }
  }

  if (normalizedPath === '/entries') {
    return { name: 'entries' }
  }

  if (normalizedPath.startsWith('/entries/')) {
    let entryId: string

    try {
      entryId = decodeURIComponent(normalizedPath.slice('/entries/'.length))
    } catch {
      window.history.replaceState({}, '', '/entries')
      return { name: 'entries' }
    }

    return entryId ? { name: 'entryDetail', entryId } : { name: 'entries' }
  }

  if (normalizedPath === '/calendar') {
    return { name: 'calendar' }
  }

  if (normalizedPath === '/insights') {
    return { name: 'insights' }
  }

  if (normalizedPath === '/tags') {
    return { name: 'tags' }
  }

  if (normalizedPath === '/settings') {
    return { name: 'settings' }
  }

  window.history.replaceState({}, '', '/')

  return { name: 'home' }
}

function normalizePathname(pathname: string): string {
  if (pathname === '/') {
    return pathname
  }

  return pathname.replace(/\/+$/, '') || '/'
}
