import type { Mood } from '../types/diary'
import { getMoodVisual } from './diaryUiConfig'

export type WeeklyMoodPoint = {
  label: string
  mood?: Mood
  energy?: number
  hasEntry: boolean
}

type WeeklyMoodChartProps = {
  points: WeeklyMoodPoint[]
}

/** 감정과 에너지를 함께 읽을 수 있는 7일 막대 차트다. */
export function WeeklyMoodChart({ points }: WeeklyMoodChartProps) {
  const summary = points
    .filter((point) => point.hasEntry)
    .map((point) => `${point.label} ${getMoodVisual(point.mood)?.label ?? '감정 미선택'}, 에너지 ${point.energy ?? '미선택'}`)
    .join(', ')

  return (
    <figure className="weekly-mood-chart" aria-label={`주간 감정 흐름. ${summary || '기록 없음'}`}>
      <div className="weekly-chart-bars" aria-hidden="true">
        {points.map((point) => {
          const mood = getMoodVisual(point.mood)
          const height = point.hasEntry ? Math.max(24, (point.energy ?? 3) * 17) : 10

          return (
            <div className="weekly-chart-column" key={point.label}>
              <span
                className={`weekly-chart-bar ${point.hasEntry ? '' : 'empty'}`}
                style={
                  {
                    '--bar-height': `${height}%`,
                    '--bar-color': mood?.color ?? 'var(--moodi-line-strong)',
                  } as React.CSSProperties
                }
              >
                {mood && <mood.Icon size={15} />}
              </span>
              <small>{point.label}</small>
            </div>
          )
        })}
      </div>
      <figcaption className="sr-only">{summary || '이번 주에는 아직 기록이 없습니다.'}</figcaption>
    </figure>
  )
}
