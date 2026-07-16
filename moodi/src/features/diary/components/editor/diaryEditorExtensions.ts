import { Node, mergeAttributes } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MoodiQuestionNodeView } from './MoodiQuestionNodeView'

export const MoodiQuestionBlock = Node.create({
  name: 'moodiQuestion',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      question: { default: '오늘 가장 마음에 오래 남은 순간은 무엇이었어?' },
    }
  },
  parseHTML() {
    return [{ tag: 'aside[data-moodi-question]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(HTMLAttributes, {
        'data-moodi-question': '',
        class: 'moodi-question-block',
      }),
      [
        'div',
        { class: 'moodi-question-label', contenteditable: 'false' },
        'Moodi · 조금 더 적어보고 싶다면',
      ],
      ['div', { class: 'moodi-question-answer' }, 0],
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MoodiQuestionNodeView)
  },
})

export const MoodBlock = Node.create({
  name: 'moodBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      mood: { default: 'calm' },
      label: { default: '편안함' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-moodi-mood]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-moodi-mood': HTMLAttributes.mood,
        class: 'moodi-emotion-block',
        contenteditable: 'false',
      }),
      ['span', { class: 'moodi-emotion-orb' }],
      ['span', {}, `오늘의 감정 · ${String(HTMLAttributes.label)}`],
    ]
  },
})

export const DiaryImageBlock = Node.create({
  name: 'diaryImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.querySelector('img')?.getAttribute('src'),
      },
      alt: {
        default: '',
        parseHTML: (element) => element.querySelector('img')?.getAttribute('alt') ?? '',
      },
      caption: {
        default: '',
        parseHTML: (element) => element.querySelector('figcaption')?.textContent ?? '',
      },
      width: {
        default: 'content',
        parseHTML: (element) => element.getAttribute('data-width') ?? 'content',
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') ?? 'center',
      },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-diary-image]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const { src, alt, caption, width, align } = HTMLAttributes

    return [
      'figure',
      {
        'data-diary-image': '',
        'data-width': width,
        'data-align': align,
        class: 'diary-image-block',
      },
      ['img', { src, alt }],
      caption ? ['figcaption', {}, String(caption)] : ['figcaption', { class: 'is-empty' }, ''],
    ]
  },
})

export const DiaryDetails = Node.create({
  name: 'diaryDetails',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      summary: {
        default: '접어 두고 싶은 이야기',
        parseHTML: (element) => element.querySelector('summary')?.textContent ?? '접어 두고 싶은 이야기',
      },
    }
  },
  parseHTML() {
    return [{ tag: 'details[data-diary-details]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, { 'data-diary-details': '', open: 'open' }),
      ['summary', { contenteditable: 'false' }, String(HTMLAttributes.summary)],
      ['div', { class: 'diary-details-content' }, 0],
    ]
  },
})

/** Moodi 일기에서 허용하는 블록과 인라인 서식만 구성한다. */
export const diaryEditorExtensions = [
  StarterKit.configure({
    code: false,
    codeBlock: false,
    link: false,
    underline: false,
  }),
  Underline,
  Highlight.configure({ multicolor: false }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({
    placeholder: '오늘 오래 남은 장면부터 시작해 보세요. 정리되지 않은 문장이어도 괜찮아요.',
  }),
  MoodiQuestionBlock,
  MoodBlock,
  DiaryImageBlock,
  DiaryDetails,
]
