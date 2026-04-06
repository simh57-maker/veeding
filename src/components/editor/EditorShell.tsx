'use client'

import TopBar from './TopBar'
import LeftSidebar from './LeftSidebar'
import CanvasArea from './CanvasArea'
import RightPanel from './RightPanel'
import Timeline from './Timeline'

interface Props {
  user: { id: string; email: string; name: string; image: string }
}

export default function EditorShell({ user }: Props) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1E1E1E]">
      {/* TopBar — 전체 너비 */}
      <TopBar user={user} />

      {/* 메인 영역 */}
      <div className="flex flex-1 overflow-hidden min-w-0">

        {/* LeftSidebar — 전체 높이 */}
        <LeftSidebar />

        {/* 중앙: CanvasArea + Timeline 묶음 */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <CanvasArea />
          <Timeline />
        </div>

        {/* RightPanel — 전체 높이 */}
        <RightPanel />

      </div>
    </div>
  )
}
