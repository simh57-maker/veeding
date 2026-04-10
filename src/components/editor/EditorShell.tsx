'use client'

import LeftSidebar from './LeftSidebar'
import CanvasArea from './CanvasArea'
import RightPanel from './RightPanel'

interface Props {
  user: { id: string; email: string; name: string; image: string }
}

export default function EditorShell({ user }: Props) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#1A1A1A]">
      {/* 캔버스 — 전체 화면 */}
      <CanvasArea />

      {/* 왼쪽 플로팅 패널 */}
      <div className="absolute top-5 left-5 bottom-5 z-10 pointer-events-none">
        <div className="h-full pointer-events-auto">
          <LeftSidebar user={user} />
        </div>
      </div>

      {/* 오른쪽 플로팅 패널 */}
      <div className="absolute top-5 right-5 bottom-5 z-10 pointer-events-none">
        <div className="h-full pointer-events-auto">
          <RightPanel />
        </div>
      </div>
    </div>
  )
}
