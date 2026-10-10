'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'

function statusClass(status) {
  if (status === 'received' || status === 'read') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
  if (status === 'delivered') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  if (status === 'sent') return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
  if (status === 'failed') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
  return 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
}

function ConfigPill({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full
      ${ok
        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-amber-500'}`} />
      {label}
    </span>
  )
}

export default function WhatsAppInboxPage() {
  const { doctor } = useAuth()
  const [config, setConfig] = useState(null)
  const [messages, setMessages] = useState([])
  const [listError, setListError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [to, setTo] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendOk, setSendOk] = useState('')
  const [copied, setCopied] = useState(false)

  const webhookUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/whatsapp/webhook'
    return `${window.location.origin}/api/whatsapp/webhook`
  }, [])

  const getToken = async () => auth.currentUser?.getIdToken() ?? null

  const load = useCallback(async () => {
    const token = await getToken()
    if (!token) {
      setLoading(false)
      setListError('Sign in required.')
      return
    }
    try {
      const res = await fetch('/api/whatsapp/messages?limit=80', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setListError(data.error || 'Could not load inbox.')
        return
      }
      setMessages(data.messages || [])
      setConfig(data.config || null)
      setListError(data.error || null)
    } catch {
      setListError('Could not load inbox.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 8000)
    return () => clearInterval(id)
  }, [load])

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  const handleSend = async (e) => {
    e.preventDefault()
    setSending(true)
    setSendError('')
    setSendOk('')
    try {
      const token = await getToken()
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to, text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error || 'Send failed.')
        return
      }
      setSendOk(`Sent to ${data.to}`)
      setText('')
      await load()
    } catch {
      setSendError('Send failed.')
    } finally {
      setSending(false)
    }
  }

  return (
    <AppLayout
      title="WhatsApp Inbox"
      action={
        <button onClick={load}
          className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
          Refresh
        </button>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6 pb-8">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">Cloud API test inbox</p>
          <p className="text-xs text-green-800/80 dark:text-green-300/80 mt-1 leading-relaxed">
            Existing clinic WhatsApp buttons still open WhatsApp Web. This page is a sandbox for Meta&apos;s
            webhook: verify the callback URL, receive inbound messages, and send a test reply to a number
            on the app&apos;s allowed list.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Webhook callback</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Meta Developer Console → WhatsApp → Configuration → Webhook
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-200 break-all">
              {webhookUrl}
            </code>
            <button onClick={copyUrl}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white">
              {copied ? 'Copied' : 'Copy URL'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <ConfigPill ok={Boolean(config?.verifyTokenSet)} label="Verify token" />
            <ConfigPill ok={Boolean(config?.appSecretSet)} label="App secret" />
            <ConfigPill ok={Boolean(config?.accessTokenSet)} label="Access token" />
            <ConfigPill ok={Boolean(config?.phoneNumberIdSet)} label="Phone number ID" />
          </div>
          <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-decimal pl-4">
            <li>In Meta, create or open an app with WhatsApp product access.</li>
            <li>Set <span className="font-mono">WHATSAPP_VERIFY_TOKEN</span>, <span className="font-mono">WHATSAPP_APP_SECRET</span>, <span className="font-mono">WHATSAPP_ACCESS_TOKEN</span>, and <span className="font-mono">WHATSAPP_PHONE_NUMBER_ID</span> in the host environment.</li>
            <li>Paste the callback URL above. Use the same verify token Meta asks for.</li>
            <li>Subscribe the webhook to the <span className="font-mono">messages</span> field.</li>
            <li>Add your personal number as a test recipient, then message the test business number or send from the form below.</li>
          </ol>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Local smoke test (no Meta signature)</p>
            <code className="block text-[11px] leading-relaxed bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-200 break-all">
              {`curl -X POST ${webhookUrl} -H 'Content-Type: application/json' -d '{"from":"9198XXXXXXXX","text":"hello"}'`}
            </code>
          </div>
          {!config?.canSend && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Sending is disabled until the access token and phone number ID are set. Webhook verification
              still works with only the verify token.
            </p>
          )}
        </div>

        <form onSubmit={handleSend} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Send a test message</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Use digits with country code, e.g. {doctor?.waTemplates?.countryCode || '+91'}9876543210.
              In Meta test mode the recipient must be on the allowed list.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="form-label">To</label>
              <input
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="9198XXXXXXXX"
                className="input-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Message</label>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Hello from Cliniwayz"
                className="input-field"
              />
            </div>
          </div>
          {sendError && <p className="text-xs text-red-600 dark:text-red-400">{sendError}</p>}
          {sendOk && <p className="text-xs text-green-600 dark:text-green-400">{sendOk}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={sending || !config?.canSend}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-600 text-white disabled:opacity-50">
              {sending ? 'Sending…' : 'Send via Cloud API'}
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Recent events</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Inbound messages and delivery statuses. Refreshes every 8 seconds.</p>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Loading inbox…</div>
          ) : listError ? (
            <div className="px-5 py-10 text-center text-sm text-amber-600 dark:text-amber-400">{listError}</div>
          ) : messages.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No webhook events yet. Send a message to the test number, or POST a sample payload to the callback URL.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {messages.map(msg => (
                <div key={msg.id} className="px-5 py-3.5 flex items-start gap-3">
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${msg.direction === 'in'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {msg.direction === 'in' ? 'IN' : 'OUT'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {msg.contactName || (msg.direction === 'in' ? msg.from : msg.to) || 'Unknown'}
                      </p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusClass(msg.status)}`}>
                        {msg.status || msg.kind}
                      </span>
                      {msg.type && msg.type !== 'status' && (
                        <span className="text-[10px] text-gray-400">{msg.type}</span>
                      )}
                    </div>
                    {msg.text && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-wrap break-words">{msg.text}</p>
                    )}
                    {msg.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{msg.error}</p>
                    )}
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                      {msg.createdAt || msg.timestamp || ''}
                      {msg.from && msg.direction === 'in' ? ` · from ${msg.from}` : ''}
                      {msg.to && msg.direction === 'out' ? ` · to ${msg.to}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
