import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Link as LinkIcon, Unlink, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  telegramCaptionToTiptapHtml,
  tiptapHtmlToTelegramCaption,
} from '@/lib/meditationCaption';

type Props = {
  /** Telegram-flavored HTML caption (with <b>, <i>, <a>, \n). */
  value: string;
  onChange: (telegramHtml: string) => void;
  onRestore?: () => void;
  minHeight?: number;
};

export function MeditationEditor({ value, onChange, onRestore, minHeight = 320 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener' } }),
    ],
    content: telegramCaptionToTiptapHtml(value),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[280px] px-3 py-3 [&_p]:my-0 [&_a]:text-blue-600 [&_a]:underline',
      },
    },
    onUpdate: ({ editor }) => {
      const tg = tiptapHtmlToTelegramCaption(editor.getHTML());
      onChange(tg);
    },
  });

  // Sync in external value changes (e.g. loading a saved draft or restoring template).
  useEffect(() => {
    if (!editor) return;
    const currentTg = tiptapHtmlToTelegramCaption(editor.getHTML());
    if (currentTg !== value) {
      editor.commands.setContent(telegramCaptionToTiptapHtml(value), { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Dán link (bỏ trống để xoá):', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const btn = (active: boolean) =>
    `h-8 px-2 text-xs ${active ? 'bg-primary/15 text-primary' : ''}`;

  return (
    <div className="rounded-md border bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5 bg-muted/30">
        <Button type="button" variant="ghost" size="sm"
          className={btn(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm"
          className={btn(editor.isActive('italic'))}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm"
          className={btn(editor.isActive('link'))}
          onClick={setLink}>
          <LinkIcon className="w-3.5 h-3.5 mr-1" /> Link
        </Button>
        {editor.isActive('link') && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs"
            onClick={() => editor.chain().focus().unsetLink().run()}>
            <Unlink className="w-3.5 h-3.5" />
          </Button>
        )}
        <div className="flex-1" />
        {onRestore && (
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onRestore}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Khôi phục template
          </Button>
        )}
      </div>
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default MeditationEditor;
