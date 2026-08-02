import { useCallback } from 'react'

/**
 * 일기 저장소 밖의 Moodi profile과 preference 초기화를 하나의 application action으로 묶는다.
 */
export function useMoodiDataReset() {
  return useCallback(() => true, [])
}
