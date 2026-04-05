import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Veeding — AI Video Seeding Editor',
  description: 'Professional AI-powered banner + seeding video compositor',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-[#1E1E1E] text-[#E0E0E0]">
        {children}
      </body>
    </html>
  )
}
