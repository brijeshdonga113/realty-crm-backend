'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Color from '@tiptap/extension-color'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState, useRef } from 'react'

const FONTS = [
  { label: 'Default',    value: null },
  { label: 'Inter',      value: 'Inter, sans-serif' },
  { label: 'Nunito',     value: 'Nunito, sans-serif' },
  { label: 'Serif',      value: 'Georgia, serif' },
  { label: 'Monospace',  value: 'ui-monospace, monospace' },
]

const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#bfdbfe',
  '#fbcfe8', '#fed7aa', '#e9d5ff',
]

function ToolBtn({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors select-none ${
        active
          ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-0.5 flex-shrink-0"/>
}

function Dropdown({ label, children, btnClass = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(v => !v) }}
        className={`h-7 flex items-center gap-1 px-2 rounded text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none ${btnClass}`}>
        {label}
        <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px]"
          onMouseDown={e => e.stopPropagation()}>
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}

function DropdownItem({ onClick, active, children }) {
  return (
    <button type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
      }`}>
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, placeholder, className }) {
  const [showLinkPopover, setShowLinkPopover] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const linkRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      FontFamily,
      Color,
      Placeholder.configure({ placeholder: placeholder || 'Start typing…' }),
    ],
    content: value || '',
    editorProps: {
      attributes: { class: 'rich-editor-content focus:outline-none min-h-[80px]' },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? '' : editor.getHTML())
    },
  })

  // Sync when value changes externally (e.g. loading a draft)
  useEffect(() => {
    if (!editor || editor.isFocused) return
    const current = editor.isEmpty ? '' : editor.getHTML()
    if (value !== current) editor.commands.setContent(value || '', false)
  }, [value, editor])

  // Close link popover on outside click
  useEffect(() => {
    const h = e => { if (!linkRef.current?.contains(e.target)) setShowLinkPopover(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!editor) return null

  const applyLink = () => {
    if (!linkUrl.trim()) return
    editor.chain().focus().setLink({ href: linkUrl.trim() }).run()
    setShowLinkPopover(false)
    setLinkUrl('')
  }

  const currentFont = FONTS.find(f => f.value && editor.isActive('textStyle', { fontFamily: f.value }))?.label || 'Font'

  return (
    <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-visible bg-white dark:bg-gray-700 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/10 transition-all ${className ?? ''}`}>

      {/* ── Toolbar ── */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 rounded-t-lg">

        {/* Bold */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
          </svg>
        </ToolBtn>

        {/* Italic */}
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4h-8z"/>
          </svg>
        </ToolBtn>

        {/* Underline */}
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
          </svg>
        </ToolBtn>

        {/* Strikethrough */}
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/>
          </svg>
        </ToolBtn>

        <Sep />

        {/* Font Family */}
        <Dropdown label={currentFont}>
          {({ close }) => FONTS.map(f => (
            <DropdownItem key={f.label}
              active={f.value ? editor.isActive('textStyle', { fontFamily: f.value }) : !FONTS.some(x => x.value && editor.isActive('textStyle', { fontFamily: x.value }))}
              onClick={() => {
                f.value
                  ? editor.chain().focus().setFontFamily(f.value).run()
                  : editor.chain().focus().unsetFontFamily().run()
                close()
              }}>
              <span style={{ fontFamily: f.value || 'inherit' }}>{f.label}</span>
            </DropdownItem>
          ))}
        </Dropdown>

        <Sep />

        {/* Highlight */}
        <Dropdown
          label={
            <span className="flex flex-col items-center leading-none gap-px">
              <span className="text-xs font-bold">A</span>
              <span className="w-3 h-1 rounded-sm"
                style={{ backgroundColor: editor.isActive('highlight') ? (editor.getAttributes('highlight').color || '#fef08a') : '#fef08a' }}/>
            </span>
          }
        >
          {({ close }) => (
            <div className="p-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 px-1">Highlight colour</p>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c} type="button"
                    onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHighlight({ color: c }).run(); close() }}
                    className="w-8 h-8 rounded-md border-2 transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: c, borderColor: editor.isActive('highlight', { color: c }) ? '#167876' : 'transparent' }}/>
                ))}
              </div>
              <button type="button"
                onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); close() }}
                className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 text-center py-1 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                Remove highlight
              </button>
            </div>
          )}
        </Dropdown>

        <Sep />

        {/* Heading / size */}
        <Dropdown label={
          editor.isActive('heading', { level: 1 }) ? 'H1' :
          editor.isActive('heading', { level: 2 }) ? 'H2' :
          editor.isActive('heading', { level: 3 }) ? 'H3' : 'Normal'
        }>
          {({ close }) => [
            { label: 'Normal', action: () => editor.chain().focus().setParagraph().run(), active: editor.isActive('paragraph') },
            { label: 'Heading 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
            { label: 'Heading 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
            { label: 'Heading 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
          ].map(item => (
            <DropdownItem key={item.label} active={item.active} onClick={() => { item.action(); close() }}>
              {item.label}
            </DropdownItem>
          ))}
        </Dropdown>

        <Sep />

        {/* Bullet List */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </ToolBtn>

        {/* Ordered List */}
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h10M3 8h.01M3 12h.01M3 16h.01"/>
          </svg>
        </ToolBtn>

        <Sep />

        {/* Alignment */}
        <Dropdown label={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8M4 18h16"/>
          </svg>
        }>
          {({ close }) => [
            { label: 'Left',    value: 'left' },
            { label: 'Center',  value: 'center' },
            { label: 'Right',   value: 'right' },
            { label: 'Justify', value: 'justify' },
          ].map(a => (
            <DropdownItem key={a.value} active={editor.isActive({ textAlign: a.value })}
              onClick={() => { editor.chain().focus().setTextAlign(a.value).run(); close() }}>
              {a.label}
            </DropdownItem>
          ))}
        </Dropdown>

        <Sep />

        {/* Table */}
        <Dropdown label={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
          </svg>
        }>
          {({ close }) => (
            <>
              <DropdownItem active={false} onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); close() }}>
                Insert Table (3×3)
              </DropdownItem>
              {editor.isActive('table') && (
                <>
                  <DropdownItem active={false} onClick={() => editor.chain().focus().addRowAfter().run()}>Add Row</DropdownItem>
                  <DropdownItem active={false} onClick={() => editor.chain().focus().addColumnAfter().run()}>Add Column</DropdownItem>
                  <DropdownItem active={false} onClick={() => editor.chain().focus().deleteRow().run()}>Delete Row</DropdownItem>
                  <DropdownItem active={false} onClick={() => editor.chain().focus().deleteColumn().run()}>Delete Column</DropdownItem>
                  <DropdownItem active={false} onClick={() => { editor.chain().focus().deleteTable().run(); close() }}>
                    <span className="text-red-500">Delete Table</span>
                  </DropdownItem>
                </>
              )}
            </>
          )}
        </Dropdown>

        <Sep />

        {/* Link */}
        <div className="relative" ref={linkRef}>
          <ToolBtn
            onClick={() => {
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run()
              } else {
                setLinkUrl(editor.getAttributes('link').href || '')
                setShowLinkPopover(v => !v)
              }
            }}
            active={editor.isActive('link')}
            title="Link"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
          </ToolBtn>
          {showLinkPopover && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl p-3 min-w-[220px]"
              onMouseDown={e => e.stopPropagation()}>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">URL</p>
              <input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } }}
                placeholder="https://…"
                autoFocus
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-primary-500 mb-2"
              />
              <div className="flex gap-2">
                <button type="button" onMouseDown={e => { e.preventDefault(); applyLink() }}
                  className="flex-1 px-2.5 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium rounded-lg transition-colors">
                  Apply
                </button>
                <button type="button" onMouseDown={e => { e.preventDefault(); setShowLinkPopover(false) }}
                  className="px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Editor Content ── */}
      <div className="px-3.5 py-2.5">
        <EditorContent editor={editor}/>
      </div>

    </div>
  )
}
