'use client'

import LeftSidebar from './LeftSidebar'
import CanvasArea from './CanvasArea'
import RightPanel from './RightPanel'
import Timeline from './Timeline'

interface Props {
  user: { id: string; email: string; name: string; image: string }
}

export default function EditorShell({ user }: Props) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1E1E1E]">
      <LeftSidebar user={user} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <CanvasArea />
        <Timeline />
      </div>

      <RightPanel />
    </div>
  )
}
