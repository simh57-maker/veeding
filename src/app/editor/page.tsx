import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import EditorShell from '@/components/editor/EditorShell'

export default async function EditorPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <EditorShell
      user={{
        id: session.user.id ?? session.user.email ?? '',
        email: session.user.email ?? '',
        name: session.user.name ?? '',
        image: session.user.image ?? '',
      }}
    />
  )
}
