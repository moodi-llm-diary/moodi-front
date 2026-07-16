import type { ComponentProps } from 'react'
import { DiaryEditor } from '../DiaryEditor'

type WriteWorkspaceViewProps = ComponentProps<typeof DiaryEditor>

/** 일기 작성 route에서 종이형 editor 하나만 조립한다. */
export function WriteWorkspaceView(props: WriteWorkspaceViewProps) {
  return (
    <div className="workspace-page write-workspace-page">
      <DiaryEditor {...props} />
    </div>
  )
}
