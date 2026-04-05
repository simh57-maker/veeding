'use client'

import TopBar from './TopBar'
import LeftSidebar from './LeftSidebar'
import CanvasArea from './CanvasArea'
import RightPanel from './RightPanel'
import Timeline from './Timeline'

interface Props {
  user: { id: string; email: string }
}

export default function EditorShell({ user }: Props) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1E1E1E]">
      {/* Top Bar */}
      <TopBar user={user} />

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar />

        {/* Canvas */}
        <CanvasArea />

        {/* Right Properties Panel */}
        <RightPanel />
      </div>

      {/* Bottom Timeline */}
      <Timeline />
    </div>
  )
}
