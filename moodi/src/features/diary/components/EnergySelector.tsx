type EnergySelectorProps = {
  value?: number
  onChange: (energy: number) => void
  compact?: boolean
  onClear?: () => void
}

const energyLabels = ['거의 없음', '낮음', '보통', '좋음', '충만함']

/** 1~5 단계의 에너지를 명시적 라벨과 함께 선택한다. */
export function EnergySelector({ value, onChange, compact = false, onClear }: EnergySelectorProps) {
  return (
    <fieldset className={`energy-selector ${compact ? 'compact' : ''}`}>
      <legend>에너지 상태</legend>
      {value && onClear && (
        <button className="selector-clear-button" onClick={onClear} type="button">
          에너지 선택 지우기
        </button>
      )}
      <div className="energy-options">
        {energyLabels.map((label, index) => {
          const energy = index + 1
          const isSelected = value === energy

          return (
            <button
              aria-label={`에너지 ${energy}단계, ${label}`}
              aria-pressed={isSelected}
              className={isSelected ? 'selected' : ''}
              key={label}
              onClick={() => onChange(energy)}
              type="button"
            >
              <span className="energy-bars" aria-hidden="true">
                {Array.from({ length: 5 }, (_, barIndex) => (
                  <span className={barIndex < energy ? 'filled' : ''} key={barIndex} />
                ))}
              </span>
              {!compact && <span>{label}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
