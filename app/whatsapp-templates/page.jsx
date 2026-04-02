'use client'
import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'

const DEFAULT_TEMPLATES = {
  countryCode: '+91',
  appointment: {
    label: 'Appointment Reminder',
    description: 'Sent when reminding a patient about an upcoming appointment',
    template: 'Hello {name},\n\nThis is a reminder for your appointment at {clinic} on *{date}* at *{time}*.\n\nPlease arrive 5 minutes early. If you need to reschedule, please contact us.\n\nThank you!',
  },
  nextday: {
    label: 'Next Day Reminder',
    description: 'Sent one day before the appointment',
    template: 'Hello {name},\n\nJust a reminder — your appointment at {clinic} is *tomorrow, {date}* at *{time}*.\n\nWe look forward to seeing you!\n\nThank you!',
  },
  followup: {
    label: 'Follow-up Reminder',
    description: 'Sent for scheduled follow-up visits',
    template: 'Hello {name},\n\nThis is a reminder that your follow-up visit at {clinic} is scheduled on *{date}*.\n\nPlease let us know if you need to reschedule.\n\nThank you!',
  },
  tomorrow: {
    label: 'Follow-up Tomorrow',
    description: 'Sent one day before a follow-up',
    template: 'Hello {name},\n\nJust a reminder — your follow-up visit at {clinic} is *tomorrow, {date}*.\n\nWe look forward to seeing you!\n\nThank you!',
  },
  today: {
    label: 'Follow-up Today',
    description: 'Sent on the day of the follow-up',
    template: 'Hello {name},\n\nYour follow-up at {clinic} is *today*. Please visit us at your earliest convenience.\n\nThank you!',
  },
  missed: {
    label: 'Missed Follow-up',
    description: 'Sent when a follow-up was overdue',
    template: 'Hello {name},\n\nWe noticed your follow-up scheduled on *{date}* was {days} day(s) ago. We care about your health.\n\nPlease visit us at {clinic} soon.\n\nThank you!',
  },
}

const VARIABLES = ['{name}', '{clinic}', '{date}', '{time}', '{days}']

function TemplateCard({ id, config, value, onChange, onReset }) {
  const [preview, setPreview] = useState(false)
  const { doctor } = useAuth()

  const previewMsg = (value || '').
    replace(/\{name\}/g, 'Patient Name')
    .replace(/\{clinic\}/g, doctor?.clinicName || 'Clinic Name')
    .replace(/\{date\}/g, 'Jan 5, 2026')
    .replace(/\{time\}/g, '10:30 AM')
    .replace(/\{days\}/g, '3')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{config.label}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{config.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setPreview(p => !p)}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors border
              ${preview
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button onClick={() => onReset(id)}
            className="text-xs px-2.5 py-1 rounded-lg font-medium border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-red-500 transition-colors">
            Reset
          </button>
        </div>
      </div>
      <div className="p-5">
        {preview ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-2">Message Preview</p>
            <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{previewMsg}</pre>
          </div>
        ) : (
          <textarea
            value={value || ''}
            onChange={e => onChange(id, e.target.value)}
            rows={5}
            className="input-field resize-none font-mono text-sm"
            placeholder={config.template}
          />
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {VARIABLES.map(v => (
            <button key={v} type="button"
              onClick={() => onChange(id, (value || '') + v)}
              className="text-xs font-mono px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 rounded transition-colors">
              {v}
            </button>
          ))}
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1 self-center">Click to insert variable</span>
        </div>
      </div>
    </div>
  )
}

export default function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = useState({})
  const [countryCode, setCountryCode] = useState('+91')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('whatsapp_templates') || '{}')
      setTemplates(stored)
      setCountryCode(stored.countryCode || '+91')
    } catch {}
  }, [])

  const handleChange = (id, value) => {
    setSaved(false)
    setTemplates(t => ({ ...t, [id]: { ...DEFAULT_TEMPLATES[id], ...(t[id] || {}), template: value } }))
  }

  const handleReset = (id) => {
    setSaved(false)
    setTemplates(t => { const next = { ...t }; delete next[id]; return next })
  }

  const handleSave = () => {
    const toStore = { ...templates, countryCode }
    localStorage.setItem('whatsapp_templates', JSON.stringify(toStore))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const getValue = (id) => templates[id]?.template || DEFAULT_TEMPLATES[id]?.template || ''

  return (
    <AppLayout
      title="WhatsApp Templates"
      action={
        <button onClick={handleSave}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2
            ${saved
              ? 'bg-green-500 text-white'
              : 'bg-primary-500 hover:bg-primary-600 text-white'}`}>
          {saved ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              Saved!
            </>
          ) : 'Save All Templates'}
        </button>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Country code */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">WhatsApp Settings</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Default country code used when sending messages</p>
          <div className="flex items-center gap-3 max-w-xs">
            <div className="flex-1">
              <label className="form-label">Country Code</label>
              <input
                value={countryCode}
                onChange={e => { setCountryCode(e.target.value); setSaved(false) }}
                placeholder="+91"
                className="input-field"
              />
            </div>
            <div className="flex-1">
              <label className="form-label">Preview</label>
              <div className="input-field bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm">
                {countryCode}9876543210
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-primary-800 dark:text-primary-300 mb-1">Template Variables</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {[
              ['{name}',   'Patient full name'],
              ['{clinic}', 'Clinic / hospital name'],
              ['{date}',   'Appointment or follow-up date'],
              ['{time}',   'Appointment time'],
              ['{days}',   'Number of overdue days'],
            ].map(([v, desc]) => (
              <div key={v} className="text-xs">
                <span className="font-mono font-semibold text-primary-700 dark:text-primary-300">{v}</span>
                <span className="text-gray-500 dark:text-gray-400"> — {desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Templates */}
        {Object.entries(DEFAULT_TEMPLATES).filter(([k]) => k !== 'countryCode').map(([id, config]) => (
          <TemplateCard
            key={id}
            id={id}
            config={config}
            value={getValue(id)}
            onChange={handleChange}
            onReset={handleReset}
          />
        ))}

        <div className="flex justify-end pb-6">
          <button onClick={handleSave}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors
              ${saved ? 'bg-green-500 text-white' : 'bg-primary-500 hover:bg-primary-600 text-white'}`}>
            {saved ? '✓ Saved!' : 'Save All Templates'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
