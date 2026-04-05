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
      {/* Top Bar — 전체 너비 */}
      <TopBar user={user} />

      {/* 사이드바 + 캔버스 + 우측패널 */}
      <div className="flex flex-1 overflow-hidden min-w-0">
        <LeftSidebar />
        <CanvasArea />
        <RightPanel />
      </div>

      {/* Timeline — LeftSidebar 너비만큼 왼쪽 여백을 맞춤 */}
      <Timeline />
    </div>
  )
}
