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
      <TopBar user={user} />

      <div className="flex flex-1 overflow-hidden min-w-0">
        {/* w-120 = 480px (w-60의 2배) */}
        <LeftSidebar />
        <CanvasArea />
        <RightPanel />
      </div>

      <Timeline />
    </div>
  )
}
