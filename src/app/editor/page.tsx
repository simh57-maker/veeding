import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditorShell from '@/components/editor/EditorShell'

export default async function EditorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <EditorShell user={{ id: user.id, email: user.email ?? '' }} />
}
