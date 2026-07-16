import {
  BookOpen,
  BriefcaseBusiness,
  Cloud,
  CloudRain,
  Coffee,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Home,
  Minus,
  Moon,
  Music2,
  Smile,
  Sparkles,
  Users,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import type { Activity, Mood } from '../types/diary'

export type MoodVisualOption = {
  value: Mood
  label: string
  shortLabel: string
  description: string
  color: string
  Icon: LucideIcon
}

export type ActivityOption = {
  value: Activity
  label: string
  Icon: LucideIcon
}

export const MOOD_VISUAL_OPTIONS: MoodVisualOption[] = [
  {
    value: 'happy',
    label: '행복',
    shortLabel: '행복',
    description: '기쁨이 또렷한 상태',
    color: 'var(--mood-happy)',
    Icon: Smile,
  },
  {
    value: 'calm',
    label: '편안함',
    shortLabel: '편안',
    description: '마음이 잔잔한 상태',
    color: 'var(--mood-calm)',
    Icon: Waves,
  },
  {
    value: 'excited',
    label: '설렘',
    shortLabel: '설렘',
    description: '기대가 차오르는 상태',
    color: 'var(--mood-excited)',
    Icon: Sparkles,
  },
  {
    value: 'neutral',
    label: '무난함',
    shortLabel: '무난',
    description: '크게 흔들리지 않는 상태',
    color: 'var(--mood-neutral)',
    Icon: Minus,
  },
  {
    value: 'tired',
    label: '피곤함',
    shortLabel: '피곤',
    description: '에너지가 낮은 상태',
    color: 'var(--mood-tired)',
    Icon: Moon,
  },
  {
    value: 'anxious',
    label: '불안함',
    shortLabel: '불안',
    description: '마음이 자꾸 앞서는 상태',
    color: 'var(--mood-anxious)',
    Icon: Wind,
  },
  {
    value: 'frustrated',
    label: '답답함',
    shortLabel: '답답',
    description: '생각이 막혀 있는 상태',
    color: 'var(--mood-frustrated)',
    Icon: Cloud,
  },
  {
    value: 'sad',
    label: '슬픔',
    shortLabel: '슬픔',
    description: '마음이 가라앉은 상태',
    color: 'var(--mood-sad)',
    Icon: CloudRain,
  },
  {
    value: 'angry',
    label: '화남',
    shortLabel: '화남',
    description: '불편함이 강하게 남은 상태',
    color: 'var(--mood-angry)',
    Icon: Flame,
  },
]

export const ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: 'work', label: '일·프로젝트', Icon: BriefcaseBusiness },
  { value: 'people', label: '사람들과 함께', Icon: Users },
  { value: 'exercise', label: '운동', Icon: Dumbbell },
  { value: 'study', label: '공부·독서', Icon: BookOpen },
  { value: 'walk', label: '산책·이동', Icon: Footprints },
  { value: 'rest', label: '휴식', Icon: Home },
  { value: 'music', label: '음악', Icon: Music2 },
  { value: 'meal', label: '식사', Icon: Coffee },
  { value: 'self-care', label: '나를 돌봄', Icon: Heart },
]

export const JOURNAL_PROMPTS = [
  '오늘 가장 오래 마음에 남은 장면은 무엇이었나요?',
  '지금의 감정이 시작된 순간을 떠올려 본다면요?',
  '오늘의 나에게 꼭 남겨두고 싶은 한 문장이 있나요?',
  '생각보다 잘 해낸 작은 일은 무엇이었나요?',
  '내일의 내가 기억하면 좋을 오늘의 단서는 무엇인가요?',
]

export const DAILY_SENTENCES = [
  '완벽한 문장보다 솔직한 한 줄이 오래 남아요.',
  '지나간 하루를 붙잡기보다, 오늘의 결을 가볍게 남겨보세요.',
  '마음이 선명하지 않아도 괜찮아요. 흐릿함도 오늘의 기록이에요.',
  '작은 사건 하나가 나중에는 중요한 기억의 단서가 되기도 해요.',
]

export function getMoodVisual(mood?: Mood): MoodVisualOption | undefined {
  return MOOD_VISUAL_OPTIONS.find((option) => option.value === mood)
}

export function getActivityLabel(activity: Activity): string {
  return ACTIVITY_OPTIONS.find((option) => option.value === activity)?.label ?? activity
}
