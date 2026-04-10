import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

interface TiptapEditorProps {
  content: string
  onUpdate: (html: string) => void
  editable?: boolean
}

export function TiptapEditor({ content, onUpdate, editable = true }: TiptapEditorProps): React.ReactNode {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  return (
    <div className="tiptap-editor-wrapper">
      <EditorContent editor={editor} className="tiptap-editor" />
    </div>
  )
}
