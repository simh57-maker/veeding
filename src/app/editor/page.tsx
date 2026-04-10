import EditorShell from '@/components/editor/EditorShell'

export default function EditorPage() {
  return (
    <EditorShell
      user={{
        id: 'guest',
        email: '',
        name: 'Guest',
        image: '',
      }}
    />
  )
}
