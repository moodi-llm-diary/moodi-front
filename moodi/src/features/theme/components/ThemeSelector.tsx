import { Check, Palette } from 'lucide-react'
import type { ThemeName, ThemeOption } from '../types/theme'
import './ThemeSelector.css'

type ThemeSelectorProps = {
  activeTheme: ThemeName
  options: ThemeOption[]
  onSelectTheme: (themeName: ThemeName) => void
}

/**
 * 테마 선택 UI를 표시하고 선택 이벤트만 전달한다.
 */
export function ThemeSelector({
  activeTheme,
  options,
  onSelectTheme,
}: ThemeSelectorProps) {
  return (
    <section
      aria-label="테마 선택"
      className="theme-selector"
    >
      <div className="theme-selector-heading">
        <span className="theme-eyebrow">
          <Palette aria-hidden="true" size={15} />
          화면 분위기
        </span>
        <h2>테마 선택</h2>
      </div>

      <div className="theme-option-list">
        {options.map((themeOption) => {
          const isSelected = themeOption.name === activeTheme

          return (
            <button
              aria-pressed={isSelected}
              className={`theme-option ${isSelected ? 'selected' : ''}`}
              key={themeOption.name}
              onClick={() => onSelectTheme(themeOption.name)}
              title={themeOption.description}
              type="button"
            >
              <span className={`theme-swatches theme-swatches-${themeOption.name}`} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="theme-option-copy">
                <strong>{themeOption.label}</strong>
                <small>{themeOption.description}</small>
              </span>
              {isSelected && <Check aria-hidden="true" className="theme-check" size={16} />}
            </button>
          )
        })}
      </div>
    </section>
  )
}
