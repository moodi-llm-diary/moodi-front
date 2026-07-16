import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { TextSelection } from '@tiptap/pm/state'
import {
  Bold,
  CheckSquare,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Sparkles,
  Strikethrough,
  Type,
  UnderlineIcon,
  ArrowUp,
  ArrowDown,
  Trash2,
  X,
  Keyboard,
  Smile,
} from 'lucide-react'
import type { DiaryImage } from '../../types/diary'
import { createDiaryDocumentHtml } from '../../services/diaryDocumentService'
import { diaryEditorExtensions } from './diaryEditorExtensions'
import './BlockDiaryEditor.css'

type BlockDiaryEditorProps = {
  plainText: string
  contentHtml: string
  errorMessage?: string
  onChange: (plainText: string, contentHtml: string) => void
  onInsertImage: (file: File) => Promise<DiaryImage | null>
  onOpenMood: () => void
  imageRequestToken?: number
}

type MenuPosition = {
  top: number
  left: number
  maxHeight: number
  range?: { from: number; to: number }
}

/** TipTap 문서 모델을 Moodi의 따뜻한 블록 편집 경험으로 제한해 제공한다. */
export function BlockDiaryEditor({
  plainText,
  contentHtml,
  errorMessage,
  onChange,
  onInsertImage,
  onOpenMood,
  imageRequestToken,
}: BlockDiaryEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const blockMenuButtonRef = useRef<HTMLButtonElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [editorRevision, setEditorRevision] = useState(0)
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false)
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const initialContent = useMemo(
    () => createDiaryDocumentHtml(contentHtml, plainText),
    // The editor owns subsequent changes; external document replacement is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const editor = useEditor({
    extensions: diaryEditorExtensions,
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'moodi-prosemirror',
        'aria-label': '일기 본문 블록 편집기',
        'aria-describedby': errorMessage ? 'diary-editor-error' : '',
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/') {
          window.setTimeout(() => {
            const position = view.state.selection.from
            openMenuAtPosition(position, { from: position - 1, to: position })
          })
        }

        if (event.key === 'Escape' && menuPosition) {
          setMenuPosition(null)
          return true
        }

        return false
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getText({ blockSeparator: '\n\n' }), currentEditor.getHTML())
      setEditorRevision((revision) => revision + 1)
    },
    onSelectionUpdate: () => setEditorRevision((revision) => revision + 1),
  })

  useEffect(() => {
    if (!editor) return

    const nextContent = createDiaryDocumentHtml(contentHtml, plainText)

    if (contentHtml && editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false })
    }
  }, [contentHtml, editor, plainText])

  useEffect(() => {
    if (imageRequestToken) imageInputRef.current?.click()
  }, [imageRequestToken])

  useEffect(() => {
    if (!isLinkEditorOpen) return

    const frameId = window.requestAnimationFrame(() => {
      linkInputRef.current?.focus()
      linkInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isLinkEditorOpen])

  const openMenuAtPosition = (
    position: number,
    range?: { from: number; to: number },
  ) => {
    if (!editor || !wrapperRef.current) return

    const coordinates = editor.view.coordsAtPos(position)
    const wrapperRect = wrapperRef.current.getBoundingClientRect()
    const menuWidth = Math.min(330, window.innerWidth - 40)
    const availableLeft = wrapperRect.width - menuWidth
    const visualViewport = window.visualViewport
    const viewportTop = visualViewport?.offsetTop ?? 0
    const viewportBottom = viewportTop + (visualViewport?.height ?? window.innerHeight)
    const viewportInset = window.innerWidth <= 900 ? 72 : 24
    const availableBelow = viewportBottom - coordinates.bottom - viewportInset
    const availableAbove = coordinates.top - viewportTop - 24
    const shouldOpenAbove = availableBelow < 240 && availableAbove > availableBelow
    const availableHeight = shouldOpenAbove ? availableAbove : availableBelow
    const maxHeight = Math.max(80, Math.min(480, availableHeight))

    setMenuPosition({
      top: shouldOpenAbove
        ? coordinates.top - wrapperRect.top - maxHeight - 8
        : coordinates.bottom - wrapperRect.top + 8,
      left: Math.max(0, Math.min(coordinates.left - wrapperRect.left, availableLeft)),
      maxHeight,
      range,
    })
  }

  const openInsertMenu = () => {
    if (!editor) return
    editor.chain().focus().run()
    openMenuAtPosition(editor.state.selection.from)
  }

  const runCommand = (command: (editorInstance: Editor) => void) => {
    if (!editor) return

    if (menuPosition?.range) {
      editor.chain().focus().deleteRange(menuPosition.range).run()
    }
    command(editor)
    setMenuPosition(null)
  }

  const insertImage = async (file: File) => {
    const image = await onInsertImage(file)

    if (!image || !editor) return

    if (menuPosition?.range) {
      editor.chain().focus().deleteRange(menuPosition.range).run()
    }
    editor
      .chain()
      .focus()
      .insertContentAt(editor.state.doc.content.size, [
        {
          type: 'diaryImage',
          attrs: { src: image.url, alt: image.alt ?? '', caption: '', width: 'content' },
        },
        { type: 'paragraph' },
      ])
      .run()
    setMenuPosition(null)
  }

  const selectedImage = editor?.isActive('diaryImage')
    ? editor.getAttributes('diaryImage')
    : null

  return (
    <div className="block-editor" ref={wrapperRef} data-revision={editorRevision}>
      {editor && (
        <BubbleMenu
          className="editor-bubble-menu"
          editor={editor}
          options={{ placement: 'top' }}
          shouldShow={({ editor: activeEditor, from, to }) =>
            from !== to && activeEditor.isEditable
          }
        >
          {isLinkEditorOpen ? (
            <form
              className="editor-link-form"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsLinkEditorOpen(false)
              }}
              onSubmit={(event) => {
                event.preventDefault()
                const url = linkValue.trim()

                if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
                else editor.chain().focus().unsetLink().run()
                setIsLinkEditorOpen(false)
              }}
            >
              <Link2 aria-hidden="true" size={16} />
              <input
                aria-label="링크 주소"
                onChange={(event) => setLinkValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return

                  event.preventDefault()
                  setIsLinkEditorOpen(false)
                  editor.commands.focus()
                }}
                placeholder="https://"
                ref={linkInputRef}
                type="url"
                value={linkValue}
              />
              <button className="editor-link-apply" type="submit">적용</button>
              <button
                aria-label="링크 입력 닫기"
                onClick={() => {
                  setIsLinkEditorOpen(false)
                  editor.commands.focus()
                }}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </form>
          ) : (
            <>
              <InlineFormatButton editor={editor} icon={<Bold size={16} />} label="굵게" mark="bold" />
              <InlineFormatButton editor={editor} icon={<Italic size={16} />} label="기울임" mark="italic" />
              <InlineFormatButton editor={editor} icon={<UnderlineIcon size={16} />} label="밑줄" mark="underline" />
              <InlineFormatButton editor={editor} icon={<Strikethrough size={16} />} label="취소선" mark="strike" />
              <button
                aria-label="링크"
                aria-pressed={editor.isActive('link')}
                onClick={() => {
                  const previousUrl = editor.getAttributes('link').href as string | undefined

                  setLinkValue(previousUrl ?? '')
                  setIsLinkEditorOpen(true)
                }}
                type="button"
              >
                <Link2 aria-hidden="true" size={16} />
              </button>
              <button
                aria-label="하이라이트"
                aria-pressed={editor.isActive('highlight')}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                type="button"
              >
                <Highlighter aria-hidden="true" size={16} />
              </button>
            </>
          )}
        </BubbleMenu>
      )}

      <button
        aria-label="현재 위치에 블록 추가"
        className="editor-add-block"
        onClick={openInsertMenu}
        type="button"
      >
        <Plus aria-hidden="true" size={17} />
      </button>
      <button
        aria-expanded={isBlockMenuOpen}
        aria-label="현재 블록 메뉴"
        className="editor-drag-hint"
        onClick={() => setIsBlockMenuOpen((isOpen) => !isOpen)}
        ref={blockMenuButtonRef}
        type="button"
      >
        <GripVertical aria-hidden="true" size={16} />
      </button>

      {isBlockMenuOpen && editor && (
        <div
          className="editor-block-menu"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return

            event.preventDefault()
            setIsBlockMenuOpen(false)
            blockMenuButtonRef.current?.focus()
          }}
          role="menu"
        >
          <button onClick={() => moveCurrentBlock(editor, -1)} role="menuitem" type="button"><ArrowUp size={15} /> 위로 이동</button>
          <button onClick={() => moveCurrentBlock(editor, 1)} role="menuitem" type="button"><ArrowDown size={15} /> 아래로 이동</button>
          <button onClick={() => editor.chain().focus().setParagraph().run()} role="menuitem" type="button"><Type size={15} /> 일반 문단으로</button>
          <button className="is-danger" onClick={() => deleteCurrentBlock(editor)} role="menuitem" type="button"><Trash2 size={15} /> 블록 삭제</button>
        </div>
      )}

      <EditorContent editor={editor} />

      {editor && (
        <div className="mobile-block-editor-toolbar" role="toolbar" aria-label="모바일 편집 도구">
          <button aria-label="블록 추가" onClick={openInsertMenu} type="button">
            <Plus aria-hidden="true" size={19} />
            <span>블록</span>
          </button>
          <button
            aria-label="굵게"
            aria-pressed={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            type="button"
          >
            <Bold aria-hidden="true" size={18} />
            <span>서식</span>
          </button>
          <button
            aria-label="글머리 목록"
            aria-pressed={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            type="button"
          >
            <List aria-hidden="true" size={19} />
            <span>목록</span>
          </button>
          <button aria-label="사진 추가" onClick={() => imageInputRef.current?.click()} type="button">
            <ImagePlus aria-hidden="true" size={19} />
            <span>사진</span>
          </button>
          <button aria-label="감정 선택" onClick={onOpenMood} type="button">
            <Smile aria-hidden="true" size={19} />
            <span>감정</span>
          </button>
          <button aria-label="키보드 닫기" onClick={() => editor.commands.blur()} type="button">
            <Keyboard aria-hidden="true" size={19} />
            <span>닫기</span>
          </button>
        </div>
      )}

      {menuPosition && editor && (
        <SlashCommandMenu
          onChoose={runCommand}
          onClose={() => {
            setMenuPosition(null)
            editor.commands.focus()
          }}
          onRequestImage={() => imageInputRef.current?.click()}
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            maxHeight: menuPosition.maxHeight,
          }}
        />
      )}

      <input
        accept="image/*"
        aria-label="본문에 사진 블록 추가"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void insertImage(file)
          event.target.value = ''
        }}
        ref={imageInputRef}
        type="file"
      />

      {selectedImage && editor && (
        <div className="image-block-inspector" role="group" aria-label="선택한 사진 설정">
          <div className="image-block-copy-fields">
            <label>
              <span>캡션</span>
              <input
                onChange={(event) => editor.commands.updateAttributes('diaryImage', { caption: event.target.value })}
                placeholder="이 장면에 짧은 설명을 남겨보세요"
                value={String(selectedImage.caption ?? '')}
              />
            </label>
            <label>
              <span>대체 텍스트</span>
              <input
                onChange={(event) => editor.commands.updateAttributes('diaryImage', { alt: event.target.value })}
                placeholder="사진을 볼 수 없을 때 전할 설명"
                value={String(selectedImage.alt ?? '')}
              />
            </label>
          </div>
          <div>
            {(['content', 'wide', 'original'] as const).map((width) => (
              <button
                aria-pressed={selectedImage.width === width}
                key={width}
                onClick={() => editor.commands.updateAttributes('diaryImage', { width })}
                type="button"
              >
                {width === 'content' ? '본문 폭' : width === 'wide' ? '넓게' : '원본 폭'}
              </button>
            ))}
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                aria-label={`사진 ${align === 'left' ? '왼쪽' : align === 'right' ? '오른쪽' : '가운데'} 정렬`}
                aria-pressed={selectedImage.align === align}
                key={align}
                onClick={() => editor.commands.updateAttributes('diaryImage', { align })}
                type="button"
              >
                {align === 'left' ? '왼쪽' : align === 'right' ? '오른쪽' : '가운데'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InlineFormatButton({
  editor,
  icon,
  label,
  mark,
}: {
  editor: Editor
  icon: React.ReactNode
  label: string
  mark: 'bold' | 'italic' | 'underline' | 'strike'
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={editor.isActive(mark)}
      onClick={() => {
        if (mark === 'bold') editor.chain().focus().toggleBold().run()
        if (mark === 'italic') editor.chain().focus().toggleItalic().run()
        if (mark === 'underline') editor.chain().focus().toggleUnderline().run()
        if (mark === 'strike') editor.chain().focus().toggleStrike().run()
      }}
      type="button"
    >
      {icon}
    </button>
  )
}

function SlashCommandMenu({
  onChoose,
  onClose,
  onRequestImage,
  style,
}: {
  onChoose: (command: (editorInstance: Editor) => void) => void
  onClose: () => void
  onRequestImage: () => void
  style: React.CSSProperties
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const commands = useMemo(() => createSlashCommands(onRequestImage), [onRequestImage])
  const visibleCommands = commands.filter((command) =>
    `${command.label} ${command.description}`.toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => inputRef.current?.focus(), [])

  return (
    <div className="slash-command-menu" role="dialog" aria-label="블록 추가 메뉴" style={style}>
      <div className="slash-command-search">
        <Sparkles aria-hidden="true" size={16} />
        <input
          aria-label="블록 검색"
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose()
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveIndex((index) => Math.min(index + 1, visibleCommands.length - 1))
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((index) => Math.max(index - 1, 0))
            }
            if (event.key === 'Enter' && visibleCommands[activeIndex]) {
              event.preventDefault()
              onChoose(visibleCommands[activeIndex].run)
            }
          }}
          placeholder="어떤 내용을 더할까요?"
          ref={inputRef}
          value={query}
        />
      </div>
      <div className="slash-command-list" role="listbox">
        {visibleCommands.map((command, index) => (
          <button
            aria-selected={index === activeIndex}
            className={index === activeIndex ? 'is-active' : ''}
            key={command.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChoose(command.run)}
            role="option"
            type="button"
          >
            <span className="slash-command-icon">{command.icon}</span>
            <span><strong>{command.label}</strong><small>{command.description}</small></span>
          </button>
        ))}
      </div>
      <p><kbd>↑</kbd><kbd>↓</kbd> 이동 · <kbd>Enter</kbd> 선택 · <kbd>Esc</kbd> 닫기</p>
    </div>
  )
}

function createSlashCommands(onRequestImage: () => void) {
  return [
    { label: '텍스트', description: '편안한 본문 문단', icon: <Type size={17} />, run: (editor: Editor) => editor.chain().focus().setParagraph().run() },
    { label: '큰 제목', description: '하루의 큰 장면', icon: <Heading1 size={17} />, run: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: '중간 제목', description: '이야기의 새로운 장면', icon: <Heading2 size={17} />, run: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: '작은 제목', description: '짧은 구분 제목', icon: <Heading3 size={17} />, run: (editor: Editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: '사진', description: '본문 안에 장면 놓기', icon: <ImagePlus size={17} />, run: () => onRequestImage() },
    { label: '인용문', description: '오래 남은 문장 강조', icon: <Quote size={17} />, run: (editor: Editor) => editor.chain().focus().toggleBlockquote().run() },
    { label: '구분선', description: '장면 사이에 여백 만들기', icon: <Minus size={17} />, run: (editor: Editor) => editor.chain().focus().setHorizontalRule().run() },
    { label: '글머리 목록', description: '생각을 가볍게 정리', icon: <List size={17} />, run: (editor: Editor) => editor.chain().focus().toggleBulletList().run() },
    { label: '번호 목록', description: '순서가 있는 기록', icon: <ListOrdered size={17} />, run: (editor: Editor) => editor.chain().focus().toggleOrderedList().run() },
    { label: '체크리스트', description: '기억하고 싶은 작은 일', icon: <CheckSquare size={17} />, run: (editor: Editor) => editor.chain().focus().toggleTaskList().run() },
    { label: 'Moodi 질문', description: '생각을 이어갈 질문 하나', icon: <Sparkles size={17} />, run: (editor: Editor) => editor.chain().focus().insertContent({ type: 'moodiQuestion', attrs: { question: '오늘 가장 마음에 오래 남은 순간은 무엇이었어?' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '오늘 가장 마음에 오래 남은 순간은 무엇이었어?' }] }] }).run() },
  ]
}

function moveCurrentBlock(editor: Editor, direction: -1 | 1): void {
  editor.commands.command(({ state, tr, dispatch }) => {
    const blockIndex = state.selection.$from.index(0)
    const targetIndex = blockIndex + direction

    if (targetIndex < 0 || targetIndex >= state.doc.childCount) return false

    const blockNode = state.doc.child(blockIndex)
    const targetNode = state.doc.child(targetIndex)
    let blockStart = 0

    for (let index = 0; index < blockIndex; index += 1) {
      blockStart += state.doc.child(index).nodeSize
    }

    if (direction === -1) {
      const targetStart = blockStart - targetNode.nodeSize
      tr.replaceWith(targetStart, blockStart + blockNode.nodeSize, [blockNode, targetNode])
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(targetStart + 1, tr.doc.content.size))))
    } else {
      tr.replaceWith(blockStart, blockStart + blockNode.nodeSize + targetNode.nodeSize, [targetNode, blockNode])
      const nextBlockStart = blockStart + targetNode.nodeSize
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(nextBlockStart + 1, tr.doc.content.size))))
    }

    dispatch?.(tr.scrollIntoView())
    return true
  })
  editor.commands.focus()
}

function deleteCurrentBlock(editor: Editor): void {
  editor.commands.command(({ state, tr, dispatch }) => {
    const blockIndex = state.selection.$from.index(0)
    let blockStart = 0

    for (let index = 0; index < blockIndex; index += 1) {
      blockStart += state.doc.child(index).nodeSize
    }

    tr.delete(blockStart, blockStart + state.doc.child(blockIndex).nodeSize)
    dispatch?.(tr.scrollIntoView())
    return true
  })
  editor.commands.focus()
}
