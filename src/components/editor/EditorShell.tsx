'use client'

import LeftSidebar from './LeftSidebar'
import CanvasArea from './CanvasArea'
import RightPanel from './RightPanel'

interface Props {
  user: { id: string; email: string; name: string; image: string }
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'

const SHORTCUTS = [
  { label: '재생 / 멈춤',    mac: 'Space',        win: 'Space' },
  { label: '크기 비율 유지', mac: '⇧ + 드래그',   win: 'Shift + 드래그' },
  { label: '축 이동 잠금',   mac: '⇧ + 이동',     win: 'Shift + 이동' },
  { label: '되돌리기',       mac: '⌘Z',           win: 'Ctrl+Z' },
  { label: '다시 실행',      mac: '⌘⇧Z',          win: 'Ctrl+Shift+Z' },
]

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

      {/* 단축키 패널 — 왼쪽 패널 오른쪽 하단 */}
      <div className="absolute bottom-5 left-[296px] z-10 pointer-events-none">
        <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(20,20,22,0.55)' }}>
          <p className="text-[9.5px] font-medium text-white/20 uppercase tracking-widest mb-2.5">Shortcuts</p>
          {SHORTCUTS.map(({ label, mac, win }) => (
            <div key={label} className="flex items-center justify-between gap-8">
              <span className="text-[11px] text-white/20">{label}</span>
              <span className="text-[11px] font-mono text-white/15">{isMac ? mac : win}</span>
            </div>
          ))}
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
