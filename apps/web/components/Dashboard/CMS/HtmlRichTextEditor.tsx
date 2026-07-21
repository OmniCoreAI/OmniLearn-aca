'use client'

import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import {
  TextB,
  TextItalic,
  ListBullets,
  ListNumbers,
  Quotes,
  LinkSimple,
  ArrowCounterClockwise,
  ArrowClockwise,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--dash-muted))] transition-colors',
        'hover:bg-[hsl(var(--dash-canvas))] hover:text-[hsl(var(--dash-ink))]',
        active && 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]',
        disabled && 'opacity-40 pointer-events-none'
      )}
    >
      {children}
    </button>
  )
}

export default function HtmlRichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: Props) {
  const { t } = useTranslation()
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('https://')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || 'Write…' }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[hsl(var(--dash-accent))] underline' },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[220px] px-3 py-2 focus:outline-none text-[hsl(var(--dash-ink))]',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if ((value || '') !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  const openLinkModal = () => {
    if (!editor) return
    const prev = (editor.getAttributes('link').href as string | undefined) || 'https://'
    setLinkUrl(prev)
    setLinkModalOpen(true)
  }

  const applyLink = () => {
    if (!editor) return
    const url = linkUrl.trim()
    if (!url || url === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
    setLinkModalOpen(false)
  }

  const removeLink = () => {
    if (!editor) return
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkModalOpen(false)
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-gray-200 bg-white',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-gray-50/80 px-2 py-1.5">
        <ToolbarButton
          label="Bold"
          active={editor?.isActive('bold')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <TextB size={16} weight="bold" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor?.isActive('italic')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <TextItalic size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor?.isActive('bulletList')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <ListBullets size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Ordered list"
          active={editor?.isActive('orderedList')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListNumbers size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor?.isActive('blockquote')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quotes size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          active={editor?.isActive('link')}
          disabled={!editor}
          onClick={openLinkModal}
        >
          <LinkSimple size={16} />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-gray-200" />
        <ToolbarButton
          label="Undo"
          disabled={!editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <ArrowCounterClockwise size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <ArrowClockwise size={16} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />

      <Modal
        isDialogOpen={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        noPadding
        customWidth="sm:max-w-[480px] sm:min-w-[400px]"
        dialogTitle={t('cms.news.link_modal_title', 'Insert link')}
        dialogContent={
          <div className="space-y-4 p-5">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {t('cms.news.link_url', 'URL')}
              </label>
              <input
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--dash-accent))]"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://"
                dir="ltr"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyLink()
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={removeLink}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                {t('cms.news.link_remove', 'Remove link')}
              </button>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={applyLink}
                className="rounded-lg bg-[hsl(var(--dash-accent))] px-4 py-2 text-sm font-bold text-white"
              >
                {t('cms.news.link_apply', 'Apply')}
              </button>
            </div>
          </div>
        }
      />
    </div>
  )
}
