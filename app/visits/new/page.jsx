'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { usePatient } from '@/hooks/usePatients'
import { useVisits } from '@/hooks/useVisits'
import { useAuth } from '@/context/AuthContext'
import { useBlockedSlots } from '@/hooks/useBlockedSlots'
import { usePreferences } from '@/hooks/usePreferences'
import { visitService } from '@/services/visitService'
import { appointmentService } from '@/services/appointmentService'
import { billingService } from '@/services/billingService'
import { buildWAUrl } from '@/lib/whatsapp'
import { createLineItem } from '@/models/Invoice'
import { PAYMENT_METHODS, COLLECTED_BY_OPTIONS } from '@/models/Invoice'
import AutoTextarea from '@/components/ui/AutoTextarea'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { getDiagnosisSuggestions } from '@/lib/specialtyPresets'
import { useInventory } from '@/hooks/useInventory'
import { useAppointments } from '@/hooks/useAppointments'
import ServiceSuggest from '@/components/ui/ServiceSuggest'
import { Modal } from '@/components/ui/Modal'

const WA_ICON = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)



function VisitEntryForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { doctor, isReceptionist } = useAuth()
  const { formatDateFull, formatCurrency } = usePreferences()
  const { blockedSlots } = useBlockedSlots()

  useEffect(() => {
    if (doctor?.viewOnly || isReceptionist) router.replace('/dashboard')
  }, [doctor?.viewOnly, isReceptionist])

  const patientId     = searchParams.get('patientId') ?? ''
  const appointmentId = searchParams.get('appointmentId') ?? ''
  const reasonParam   = searchParams.get('reason') ?? ''
  const editVisitId   = searchParams.get('editVisitId') ?? ''
  // useRef so the active draft ID persists across re-renders without triggering
  // re-renders itself, and survives window.history.replaceState which doesn't
  // update useSearchParams in Next.js App Router.
  const draftIdRef = useRef(searchParams.get('draftId') ?? '')
  const draftId    = draftIdRef.current

  const { patient, loading: patientLoading } = usePatient(patientId)
  const { visits: allVisits, loading: visitsLoading } = useVisits(patientId)
  const { items: inventoryItems } = useInventory()
  const pastVisits = (allVisits ?? []).filter(v => v.status !== 'draft')

  const [saving, setSaving]           = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedVisit, setSavedVisit]   = useState(null)
  const [saveError, setSaveError]     = useState('')
  const [draftSaved, setDraftSaved]   = useState(false)
  // true when a draft exists (either from URL or after first Save as Draft click)
  const [isDraft, setIsDraft]         = useState(() => !!searchParams.get('draftId'))

  const [form, setForm] = useState({
    visitDate: new Date().toISOString().slice(0, 10),
    chiefComplaint: reasonParam,
    history: '',
    findings: '',
    diagnosis: [],
    treatment: '',
    prescriptions: [],
    labOrders: [],
    followUpDate: '',
    notes: '',
    vitalSigns: { bloodPressure: '', heartRate: '', temperature: '', weight: '', height: '', oxygenSat: '' },
  })

  const [payment, setPayment] = useState(() => ({
    record: true,
    amount: '',
    method: '',
    collectedBy: isReceptionist ? 'receptionist' : 'doctor',
    description: '',
    status: '',
    taxRate: 0,
    discount: 0,
  }))

  const [expandedVisitId, setExpandedVisitId] = useState(null)

  const [diagInput,    setDiagInput]    = useState('')
  const [labInput,     setLabInput]     = useState('')
  const [customDays,   setCustomDays]   = useState('')
  const [rx, setRx] = useState({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })
  const [rxSugOpen,    setRxSugOpen]    = useState(false)

  const { appointments: allAppointments } = useAppointments()
  const [useInvoice, setUseInvoice] = useState(true)
  const [invoiceLines, setInvoiceLines] = useState(() => [
    createLineItem({ description: '', itemType: 'service' })
  ])

  const invoiceSubtotal  = invoiceLines.reduce((s, l) => s + (l.total ?? 0), 0)
  const taxableSubtotal  = invoiceLines.filter(l => l.taxable !== false).reduce((s, l) => s + (l.total ?? 0), 0)
  const invoiceTaxAmount = Math.round(taxableSubtotal * (Number(payment.taxRate) || 0) / 100)
  const invoiceTotal     = invoiceSubtotal + invoiceTaxAmount - (Number(payment.discount) || 0)

  const updateLine = (id, field, raw) => {
    setInvoiceLines(prev => prev.map(line => {
      if (line.id !== id) return line
      const value   = (field === 'quantity' || field === 'unitPrice' || field === 'discountPct') ? Number(raw) : raw
      const updated = { ...line, [field]: value }
      const lineTotal  = updated.quantity * updated.unitPrice
      const discAmount = lineTotal * (Number(updated.discountPct) || 0) / 100
      return { ...updated, total: lineTotal - discAmount }
    }))
  }

  const selectService = (id, name, price) => {
    setInvoiceLines(prev => prev.map(line => {
      if (line.id !== id) return line
      const updated = { ...line, description: name, unitPrice: Number(price) || 0 }
      const lineTotal  = updated.quantity * updated.unitPrice
      const discAmount = lineTotal * (Number(updated.discountPct) || 0) / 100
      return { ...updated, total: lineTotal - discAmount }
    }))
  }

  const handleMedicineSelect = (id, invId) => {
    const inv = inventoryItems.find(i => i.id === invId) ?? null
    setInvoiceLines(prev => prev.map(line => {
      if (line.id !== id) return line
      const desc      = inv ? `${inv.name}${inv.potency ? ` (${inv.potency})` : ''}` : ''
      const unitPrice = inv ? (inv.billingPrice ? Number(inv.billingPrice) : (inv.mrp ? Number(inv.mrp) : 0)) : 0
      const lineTotal  = line.quantity * unitPrice
      const discAmount = lineTotal * (Number(line.discountPct) || 0) / 100
      return { ...line, inventoryItemId: invId || null, description: desc, unitPrice, total: lineTotal - discAmount }
    }))
  }

  const addMedicineLine = () => setInvoiceLines(p => [...p, createLineItem({ itemType: 'medicine' })])
  const addServiceLine  = (preset) => setInvoiceLines(p => [...p, createLineItem({ ...(preset ?? {}), itemType: 'service' })])

  const addRxToInvoice = (rxItem) => {
    const invItem   = inventoryItems.find(i => i.name.toLowerCase() === rxItem.medication.toLowerCase())
    const unitPrice = invItem?.billingPrice != null ? Number(invItem.billingPrice) : 0
    const base      = createLineItem({ description: rxItem.medication + (rxItem.dosage ? ` (${rxItem.dosage})` : ''), itemType: 'medicine', inventoryItemId: invItem?.id ?? null })
    setInvoiceLines(lines => [...lines, { ...base, id: `rx-${rxItem.id}`, rxId: rxItem.id, unitPrice, total: unitPrice * base.quantity }])
  }

  const removeRxFromInvoice = (rxId) => setInvoiceLines(lines => lines.filter(l => l.rxId !== rxId))

  // Pre-fill from patient data
  useEffect(() => {
    if (!patient) return
    setForm(f => ({
      ...f,
      history: f.history || (patient.chronicConditions?.length
        ? `Known conditions: ${patient.chronicConditions.join(', ')}`
        : ''),
      chiefComplaint: f.chiefComplaint || reasonParam,
    }))
  }, [patient, reasonParam])

  // Load draft data on mount when draftId URL param is present.
  // Uses direct path (patientId known) to avoid collectionGroup index requirement.
  useEffect(() => {
    const initialDraftId = draftIdRef.current
    if (!initialDraftId || !patientId) return
    visitService.getById(initialDraftId, patientId).then(draft => {
      if (!draft || draft.status !== 'draft') return
      setForm({
        visitDate:      draft.visitDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        chiefComplaint: draft.chiefComplaint || '',
        history:        draft.history || '',
        findings:       draft.examination?.findings || '',
        diagnosis:      draft.diagnosis || [],
        treatment:      draft.treatment || '',
        prescriptions:  draft.prescriptions || [],
        labOrders:      draft.labOrders || [],
        followUpDate:   draft.followUpDate || '',
        notes:          draft.notes || '',
        vitalSigns:     draft.examination?.vitalSigns || { bloodPressure: '', heartRate: '', temperature: '', weight: '', height: '', oxygenSat: '' },
      })
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  // Load existing visit data when editVisitId param is present (edit mode from patient profile).
  useEffect(() => {
    if (!editVisitId || !patientId) return
    visitService.getById(editVisitId, patientId).then(v => {
      if (!v) return
      setForm({
        visitDate:      v.visitDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        chiefComplaint: v.chiefComplaint || '',
        history:        v.history || '',
        findings:       v.examination?.findings || '',
        diagnosis:      v.diagnosis || [],
        treatment:      v.treatment || '',
        prescriptions:  v.prescriptions || [],
        labOrders:      v.labOrders || [],
        followUpDate:   v.followUpDate || '',
        notes:          v.notes || '',
        vitalSigns:     v.examination?.vitalSigns || { bloodPressure: '', heartRate: '', temperature: '', weight: '', height: '', oxygenSat: '' },
      })
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editVisitId, patientId])

  // Resume an already-started draft for this appointment (e.g. the doctor attended
  // earlier, saved as draft and left) instead of silently starting a second, blank
  // visit for the same appointment.
  useEffect(() => {
    if (draftIdRef.current || editVisitId || !patientId || !appointmentId) return
    visitService.getDraftsForPatient(patientId).then(drafts => {
      const existing = drafts.find(d => d.appointmentId === appointmentId)
      if (!existing) return
      draftIdRef.current = existing.id
      setIsDraft(true)
      const url = new URL(window.location.href)
      url.searchParams.set('draftId', existing.id)
      window.history.replaceState({}, '', url.toString())
      setForm({
        visitDate:      existing.visitDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        chiefComplaint: existing.chiefComplaint || '',
        history:        existing.history || '',
        findings:       existing.examination?.findings || '',
        diagnosis:      existing.diagnosis || [],
        treatment:      existing.treatment || '',
        prescriptions:  existing.prescriptions || [],
        labOrders:      existing.labOrders || [],
        followUpDate:   existing.followUpDate || '',
        notes:          existing.notes || '',
        vitalSigns:     existing.examination?.vitalSigns || { bloodPressure: '', heartRate: '', temperature: '', weight: '', height: '', oxygenSat: '' },
      })
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, appointmentId, editVisitId])

  const set      = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setVital = (k, v) => setForm(p => ({ ...p, vitalSigns: { ...p.vitalSigns, [k]: v } }))

  // Has the user entered anything worth not losing? Used to guard accidental exits.
  const isDirty = !savedVisit && (
    form.chiefComplaint.trim() || form.history.trim() || form.findings.trim() ||
    form.diagnosis.length > 0 || form.treatment.trim() || form.prescriptions.length > 0 ||
    form.labOrders.length > 0 || form.followUpDate || form.notes.trim() ||
    Object.values(form.vitalSigns).some(v => v.trim()) ||
    rx.medication.trim() ||
    invoiceLines.some(l => l.description.trim() || Number(l.unitPrice) > 0) ||
    Number(payment.amount) > 0
  )

  // Warn on tab close / refresh while there are unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // In-app navigation (Back / Cancel / profile link) — confirm before discarding unsaved work
  const [pendingNav, setPendingNav] = useState(null)
  const requestLeave = (navigate) => { isDirty ? setPendingNav(() => navigate) : navigate() }
  const [leavingSaving, setLeavingSaving] = useState(false)
  const saveDraftAndLeave = async () => {
    setLeavingSaving(true)
    try {
      await handleSaveDraft()
      pendingNav?.()
    } finally {
      setLeavingSaving(false)
      setPendingNav(null)
    }
  }

  const addFollowUpDays = (days) => {
    const base = form.visitDate ? new Date(form.visitDate) : new Date()
    const d = new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10)
    set('followUpDate', d)
  }

  const buildVisitData = () => ({
    patientId,
    patientName:    patient ? `${patient.firstName} ${patient.lastName}` : '',
    patientPhone:   patient?.phone || '',
    appointmentId:  appointmentId || null,
    visitDate:      form.visitDate ? new Date(form.visitDate).toISOString() : new Date().toISOString(),
    chiefComplaint: form.chiefComplaint,
    history:        form.history,
    examination:    { vitalSigns: form.vitalSigns, findings: form.findings },
    diagnosis:      form.diagnosis,
    treatment:      form.treatment,
    prescriptions:  form.prescriptions,
    labOrders:      form.labOrders,
    followUpDate:   form.followUpDate || null,
    notes:          form.notes,
    doctorId:       doctor?.id,
  })

  const handleSaveDraft = async () => {
    if (!patientId) return
    const draftPrescriptions = rx.medication.trim()
      ? [...form.prescriptions, { ...rx, id: `${Date.now()}` }]
      : form.prescriptions
    if (rx.medication.trim()) {
      set('prescriptions', draftPrescriptions)
      setRx({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })
    }
    setSavingDraft(true)
    setSaveError('')
    try {
      const saved = await visitService.saveDraft({ ...buildVisitData(), prescriptions: draftPrescriptions }, draftIdRef.current || null)
      if (saved?.id && !draftIdRef.current) {
        // First-ever save — persist the new draft ID so subsequent saves update the same doc
        draftIdRef.current = saved.id
        setIsDraft(true)
        const url = new URL(window.location.href)
        url.searchParams.set('draftId', saved.id)
        window.history.replaceState({}, '', url.toString())
      }
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 3000)
    } catch {
      setSaveError('Failed to save draft. Please try again.')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSave = async () => {
    if (!patientId || !form.chiefComplaint.trim()) return
    if (!form.followUpDate) { setSaveError('A follow-up date is required before saving.'); return }
    if (!payment.method) { setSaveError('Please select a payment method before saving.'); return }
    if (!payment.status) { setSaveError('Please mark the payment as Paid or Due before saving.'); return }
    if (useInvoice) {
      if (invoiceTotal <= 0) { setSaveError('Add at least one line item with a price before saving.'); return }
    } else {
      if (!payment.amount || Number(payment.amount) <= 0) { setSaveError('A payment amount is required before saving.'); return }
    }

    // Auto-commit any partially filled prescription before saving
    const pendingRx = rx.medication.trim() ? { ...rx, id: `${Date.now()}` } : null
    const finalPrescriptions = pendingRx
      ? [...form.prescriptions, pendingRx]
      : form.prescriptions
    if (pendingRx) setRx({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })

    // Build final invoice lines (include pending rx medicine if invoice mode)
    let finalInvoiceLines = invoiceLines
    if (useInvoice && pendingRx) {
      const invItem   = inventoryItems.find(i => i.name.toLowerCase() === pendingRx.medication.toLowerCase())
      const unitPrice = invItem?.billingPrice != null ? Number(invItem.billingPrice) : 0
      const base      = createLineItem({ description: pendingRx.medication + (pendingRx.dosage ? ` (${pendingRx.dosage})` : ''), unitPrice, itemType: 'medicine', inventoryItemId: invItem?.id ?? null })
      finalInvoiceLines = [...invoiceLines, { ...base, id: `rx-${pendingRx.id}`, rxId: pendingRx.id }]
    }

    setSaving(true)
    setSaveError('')
    try {
      const visitData = { ...buildVisitData(), prescriptions: finalPrescriptions }
      const wasFreshCreate = !editVisitId && !draftIdRef.current
      const visit = editVisitId
        ? await visitService.update(editVisitId, { ...visitData, status: 'completed' }, patientId)
        : draftIdRef.current
          ? await visitService.update(draftIdRef.current, { ...visitData, status: 'completed' }, patientId)
          : await visitService.create(visitData)
      // Remember the id immediately so a retry after a later step fails (e.g. marking the
      // appointment complete) updates this same visit instead of creating a duplicate.
      if (wasFreshCreate && visit?.id) draftIdRef.current = visit.id

      if (appointmentId) {
        await appointmentService.update(appointmentId, { status: 'completed' })
      }

      if (useInvoice) {
        const billableLines = finalInvoiceLines.filter(l => Number(l.unitPrice) > 0)
        if (billableLines.length > 0) {
          await billingService.create({
            patientId,
            patientName:   patient ? `${patient.firstName} ${patient.lastName}` : '',
            issueDate:     form.visitDate || new Date().toISOString().slice(0, 10),
            lineItems:     billableLines.map(l => createLineItem({ description: l.description, unitPrice: Number(l.unitPrice), quantity: l.quantity || 1, itemType: l.itemType, inventoryItemId: l.inventoryItemId, discountPct: l.discountPct ?? 0, taxable: l.taxable ?? true })),
            status:        payment.status,
            paymentMethod: payment.method,
            collectedBy:   payment.collectedBy,
            paymentDate:   payment.status === 'paid' ? (form.visitDate || new Date().toISOString().slice(0, 10)) : null,
            taxRate:       Number(payment.taxRate) / 100,
            discount:      Number(payment.discount),
            visitId:       visit.id,
          })
        }
      } else if (Number(payment.amount) > 0) {
        await billingService.create({
          patientId,
          patientName:   patient ? `${patient.firstName} ${patient.lastName}` : '',
          issueDate:     form.visitDate || new Date().toISOString().slice(0, 10),
          lineItems:     [createLineItem({ description: payment.description, unitPrice: Number(payment.amount), quantity: 1 })],
          status:        payment.status,
          paymentMethod: payment.method,
          collectedBy:   payment.collectedBy,
          paymentDate:   payment.status === 'paid' ? (form.visitDate || new Date().toISOString().slice(0, 10)) : null,
          taxRate:       0,
          discount:      0,
          visitId:       visit.id,
        })
      }

      setSavedVisit(visit)
    } catch (err) {
      setSaveError(err?.message || 'Failed to save visit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const openWhatsApp = () => {
    if (!patient || !savedVisit?.followUpDate) return
    const templates = doctor?.waTemplates ?? {}
    const tmpl = templates.followup?.template ||
      'Hello {name},\n\nThis is a reminder that your follow-up visit at {clinic} is scheduled on *{date}*.\n\nPlease let us know if you need to reschedule.\n\nThank you!'
    const clinicName = doctor?.clinicName || 'our clinic'
    const msg  = tmpl
      .replace(/\{name\}/g, `${patient.firstName} ${patient.lastName}`)
      .replace(/\{clinic\}/g, clinicName)
      .replace(/\{date\}/g, formatDateFull(savedVisit.followUpDate))
    window.open(buildWAUrl(patient.phone || '', msg), '_blank')
  }

  /* ───── Loading state ───── */
  if (patientLoading && patientId) return (
    <AppLayout title="Record Visit">
      <div className="flex justify-center items-center py-20 text-gray-400 text-sm gap-3">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Loading patient…
      </div>
    </AppLayout>
  )

  /* ───── Success state ───── */
  if (savedVisit) return (
    <AppLayout title="Visit Recorded">
      <div className="max-w-lg mx-auto py-10">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Visit Recorded</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {patient?.firstName}&apos;s visit has been saved.
            {appointmentId && ' Appointment marked as completed.'}
            {Number(payment.amount) > 0 && ` Payment of ₹${Number(payment.amount).toLocaleString('en-IN')} recorded.`}
          </p>

          {savedVisit.followUpDate && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-1">Follow-up Scheduled</p>
              <p className="text-sm text-orange-700 dark:text-orange-400">
                {formatDateFull(savedVisit.followUpDate)}
              </p>
              <button onClick={openWhatsApp}
                className="mt-3 flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-700 px-3 py-2 rounded-lg transition-colors w-full justify-center">
                {WA_ICON}
                Send Follow-up Reminder via WhatsApp
              </button>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push(`/patients/${patientId}`)}
              className="px-5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              View Patient Profile
            </button>
            <button onClick={() => router.push('/appointments')}
              className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm font-medium text-white transition-colors">
              Back to Appointments
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  /* ───── Form ───── */
  return (
    <AppLayout
      title={patient ? `${editVisitId ? 'Edit' : 'Visit'} — ${patient.firstName} ${patient.lastName}` : (editVisitId ? 'Edit Visit' : 'Record Visit')}
      action={
        <div className="flex items-center gap-2">
          <button onClick={() => requestLeave(() => router.back())}
            className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5">
            ← Back
          </button>
          <button type="button" onClick={handleSaveDraft}
            disabled={savingDraft || saving || !patientId}
            className="px-4 py-1.5 border border-amber-300 dark:border-amber-600 text-sm font-medium text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">
            {savingDraft && (
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {savingDraft ? 'Saving…' : draftSaved ? '✓ Draft' : 'Save Draft'}
          </button>
          <button type="button" onClick={handleSave}
            disabled={saving || !form.chiefComplaint.trim() || !patientId || !form.followUpDate || !payment.method || !payment.status || (useInvoice ? invoiceTotal <= 0 : (!payment.amount || Number(payment.amount) <= 0))}
            className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5">
            {saving && (
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {saving ? 'Saving…' : isDraft ? 'Complete Visit' : 'Save Visit'}
          </button>
        </div>
      }
    >
      <div className="max-w-6xl mx-auto pb-10">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-5">

        {/* Draft banner */}
        {isDraft && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
              <span className="font-semibold">Continuing a draft visit.</span> Fill in the remaining details and click <span className="font-semibold">Complete Visit</span> to finalise.
            </p>
          </div>
        )}

        {/* Patient banner */}
        {patient && (
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-700 dark:text-primary-300 font-bold text-sm">
                {patient.firstName?.[0]}{patient.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">{patient.firstName} {patient.lastName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {patient.phone}
                {patient.bloodType && ` · ${patient.bloodType}`}
                {patient.chronicConditions?.length > 0 && ` · ${patient.chronicConditions.join(', ')}`}
              </p>
            </div>
            <button onClick={() => requestLeave(() => router.push(`/patients/${patientId}`))}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium flex-shrink-0">
              View Profile →
            </button>
          </div>
        )}

        {/* Clinical info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Clinical Information</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Visit Date</label>
              <input
                type="date"
                value={form.visitDate}
                onChange={e => set('visitDate', e.target.value)}
                className="input-field text-sm py-1.5 w-auto"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Chief Complaint <span className="text-red-500">*</span></label>
            <input value={form.chiefComplaint} onChange={e => set('chiefComplaint', e.target.value)}
              placeholder="Patient's main concern" className="input-field"/>
          </div>

          <div>
            <label className="form-label">History of Present Illness</label>
            <RichTextEditor value={form.history} onChange={html => set('history', html)}
              placeholder="Detailed history, existing conditions, onset, duration…"/>
          </div>

          {/* Vitals */}
          <div>
            <p className="form-label">Vital Signs</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['bloodPressure', 'Blood Pressure', 'e.g. 120/80'],
                ['heartRate',     'Heart Rate (bpm)', 'e.g. 72'],
                ['temperature',   'Temp (°C)',        'e.g. 36.6'],
                ['weight',        'Weight (kg)',      'e.g. 70'],
                ['height',        'Height (cm)',      'e.g. 175'],
                ['oxygenSat',     'SpO₂ (%)',         'e.g. 98'],
              ].map(([k, lbl, ph]) => (
                <div key={k}>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{lbl}</label>
                  <input value={form.vitalSigns[k]} onChange={e => setVital(k, e.target.value)}
                    placeholder={ph} className="input-field text-sm py-2"/>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Clinical Findings</label>
            <RichTextEditor value={form.findings} onChange={html => set('findings', html)}
              placeholder="Physical examination findings…"/>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="form-label">Diagnosis</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.diagnosis.map(d => (
                <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs rounded-full font-medium">
                  {d}
                  <button type="button" onClick={() => set('diagnosis', form.diagnosis.filter(x => x !== d))}
                    className="hover:text-red-500 ml-0.5">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <input value={diagInput} onChange={e => setDiagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') }}}}
                placeholder="Type and press Enter" className="input-field flex-1"/>
              <button type="button" onClick={() => { if (diagInput.trim()) { set('diagnosis', [...form.diagnosis, diagInput.trim()]); setDiagInput('') }}}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {getDiagnosisSuggestions(doctor?.specialization)
                .filter(s => !form.diagnosis.includes(s) && (!diagInput || s.toLowerCase().includes(diagInput.toLowerCase())))
                .map(s => (
                  <button key={s} type="button"
                    onClick={() => { set('diagnosis', [...form.diagnosis, s]); setDiagInput('') }}
                    className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-gray-600 dark:text-gray-300 hover:text-teal-700 dark:hover:text-teal-300 rounded-full transition-colors">
                    + {s}
                  </button>
                ))}
            </div>
          </div>

          <div>
            <label className="form-label">Treatment Plan</label>
            <RichTextEditor value={form.treatment} onChange={html => set('treatment', html)}
              placeholder="Treatment approach…"/>
          </div>

          {/* Prescriptions */}
          <div>
            <label className="form-label">Prescriptions</label>
            {form.prescriptions.map((p, i) => (
              <div key={p.id ?? i} className="flex items-start gap-2 mb-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-sm">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 dark:text-white">{p.medication} — {p.dosage}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{p.frequency} · {p.duration}</p>
                </div>
                <button type="button" onClick={() => {
                  const pres = form.prescriptions[i]
                  set('prescriptions', form.prescriptions.filter((_, j) => j !== i))
                  if (useInvoice && pres?.id) removeRxFromInvoice(pres.id)
                }} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="relative">
                <input value={rx.medication}
                  onChange={e => { setRx(p => ({...p, medication: e.target.value})); setRxSugOpen(true) }}
                  onFocus={() => setRxSugOpen(true)}
                  onBlur={() => setTimeout(() => setRxSugOpen(false), 100)}
                  placeholder="Medication name"
                  className="input-field text-sm py-2 w-full"
                  autoComplete="off"
                />
                {rxSugOpen && rx.medication.trim().length > 0 && (() => {
                  const q = rx.medication.toLowerCase()
                  const matches = inventoryItems.filter(it => it.name.toLowerCase().includes(q)).slice(0, 8)
                  return matches.length > 0 ? (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                      {matches.map(it => (
                        <button key={it.id} type="button"
                          onMouseDown={() => {
                            setRx(p => ({
                              ...p,
                              medication: it.name,
                              dosage: p.dosage || it.potency || '',
                            }))
                            setRxSugOpen(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center justify-between gap-2 transition-colors">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{it.name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                            {[it.potency, it.dosageForm || it.category].filter(Boolean).join(' · ')}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
              <input value={rx.dosage}    onChange={e => setRx(p => ({...p, dosage:    e.target.value}))} placeholder="Dosage (e.g. 500mg)"        className="input-field text-sm py-2"/>
              <input value={rx.frequency} onChange={e => setRx(p => ({...p, frequency: e.target.value}))} placeholder="Frequency (e.g. Twice daily)" className="input-field text-sm py-2"/>
              <input value={rx.duration}  onChange={e => setRx(p => ({...p, duration:  e.target.value}))} placeholder="Duration (e.g. 7 days)"      className="input-field text-sm py-2"/>
            </div>
            <input value={rx.instructions} onChange={e => setRx(p => ({...p, instructions: e.target.value}))}
              placeholder="Special instructions (e.g. Take after meals)" className="input-field text-sm py-2 mb-2"/>
            <button type="button" onClick={() => {
              if (rx.medication.trim()) {
                const newRx = { ...rx, id: `${Date.now()}` }
                set('prescriptions', [...form.prescriptions, newRx])
                if (useInvoice) addRxToInvoice(newRx)
                setRx({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' })
                setRxSugOpen(false)
              }
            }} className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">+ Add prescription</button>
          </div>

          {/* Lab orders */}
          <div>
            <label className="form-label">Lab Orders</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.labOrders.map(l => (
                <span key={l} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full font-medium">
                  {l}
                  <button type="button" onClick={() => set('labOrders', form.labOrders.filter(x => x !== l))}
                    className="hover:text-red-500 ml-0.5">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={labInput} onChange={e => setLabInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (labInput.trim()) { set('labOrders', [...form.labOrders, labInput.trim()]); setLabInput('') }}}}
                placeholder="Lab test name" className="input-field flex-1 text-sm py-2"/>
              <button type="button" onClick={() => { if (labInput.trim()) { set('labOrders', [...form.labOrders, labInput.trim()]); setLabInput('') }}}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors">Add</button>
            </div>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <RichTextEditor value={form.notes} onChange={html => set('notes', html)}
              placeholder="Additional notes…"/>
          </div>
        </div>

        {/* Follow-up date */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Follow-up Date <span className="text-red-500">*</span></h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Required — select a quick interval or pick a custom date</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {[[7,'+7'],[10,'+10'],[15,'+15'],[21,'+21'],[30,'+30']].map(([days, label]) => (
              <button key={days} type="button" onClick={() => addFollowUpDays(days)}
                className="text-xs px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700 rounded-lg font-medium transition-colors">
                {label}d
              </button>
            ))}
            {/* Custom days input */}
            <div className="flex items-center gap-1.5">
              <input
                type="number" min="1" max="365"
                value={customDays}
                onChange={e => setCustomDays(e.target.value)}
                placeholder="Custom"
                className="input-field text-xs py-1.5 w-20"
              />
              <button type="button"
                onClick={() => { const d = parseInt(customDays); if (d > 0) { addFollowUpDays(d); setCustomDays('') } }}
                disabled={!customDays || parseInt(customDays) < 1}
                className="text-xs px-2.5 py-1.5 bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700 rounded-lg font-medium transition-colors disabled:opacity-40">
                Set
              </button>
            </div>
          </div>
          <input type="date" value={form.followUpDate}
            onChange={e => set('followUpDate', e.target.value)} className="input-field"/>
          {form.followUpDate && blockedSlots.some(b => b.date === form.followUpDate) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              You are blocked on this day — consider picking another date.
            </p>
          )}
          {form.followUpDate && (
            <div className="mt-2 flex items-center gap-3">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                📅 {formatDateFull(form.followUpDate)}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                ({Math.round((new Date(form.followUpDate) - new Date()) / 86400000)} days from today)
              </p>
              <button type="button" onClick={() => set('followUpDate', '')}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                Clear
              </button>
            </div>
          )}
          {/* Appointments already booked on the selected follow-up date */}
          {form.followUpDate && (() => {
            const apptOnDay = allAppointments.filter(a => a.date === form.followUpDate && a.status !== 'cancelled')
            if (!apptOnDay.length) return null
            return (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  {apptOnDay.length} appointment{apptOnDay.length !== 1 ? 's' : ''} already on this day:
                </p>
                <div className="space-y-1.5">
                  {apptOnDay.map(a => (
                    <div key={a.id} className="flex items-center gap-3 text-xs bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                      <span className="font-bold text-blue-700 dark:text-blue-300 tabular-nums w-10 flex-shrink-0">{a.time}</span>
                      <span className="text-gray-700 dark:text-gray-300 font-medium flex-1 truncate">{a.patientName}</span>
                      <span className="text-gray-400 dark:text-gray-500 capitalize hidden sm:block">{a.type?.replace(/_/g, ' ') || 'Appointment'}</span>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded font-medium capitalize ${
                        a.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                        a.status === 'scheduled' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>{a.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Payment / Invoice */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          {/* Header */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Payment Collection <span className="text-red-500">*</span></h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Add line items and record payment for this visit</p>
          </div>

          {useInvoice ? (
            /* ── Invoice mode ── */
            <div className="space-y-4">
              {/* Header + Add buttons */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm">Line Items</h4>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={addMedicineLine}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
                    </svg>
                    Add Medicine
                  </button>
                  <button type="button" onClick={() => addServiceLine()}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                    </svg>
                    Add Service
                  </button>
                </div>
              </div>

              {/* Quick-add from doctor's saved service charges */}
              {(doctor?.serviceCharges ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500 self-center mr-1">Quick add:</span>
                  {(doctor?.serviceCharges ?? []).map(sc => (
                    <button key={sc.id} type="button"
                      onClick={() => addServiceLine({ description: sc.name, unitPrice: sc.price || 0 })}
                      className="text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300 border border-gray-200 dark:border-gray-600 hover:border-blue-300 rounded-lg font-medium transition-colors">
                      + {sc.name}{sc.price > 0 ? ` (₹${Number(sc.price).toLocaleString('en-IN')})` : ''}
                    </button>
                  ))}
                </div>
              )}

              {/* Column headers + rows */}
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-3">
                  <span className="col-span-4">Description / Medicine</span>
                  <span className="col-span-1 text-center">Tax</span>
                  <span className="col-span-1 text-center">Disc</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-2">Unit Price</span>
                  <span className="col-span-1 text-right">Total</span>
                  <span className="col-span-1"/>
                </div>

                {invoiceLines.map(line => {
                  const isMedicine = line.itemType === 'medicine'
                  const linkedInv  = isMedicine && line.inventoryItemId
                    ? inventoryItems.find(i => i.id === line.inventoryItemId)
                    : null

                  return (
                    <div key={line.id}
                      className={`grid grid-cols-12 gap-2 items-start p-3 rounded-xl border transition-colors ${
                        isMedicine
                          ? 'bg-teal-50/40 dark:bg-teal-900/10 border-teal-100 dark:border-teal-800'
                          : 'bg-blue-50/30 dark:bg-blue-900/5 border-blue-100 dark:border-blue-900/40'
                      }`}>

                      {/* Description / Medicine select */}
                      <div className="col-span-4">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isMedicine
                              ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
                              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          }`}>
                            {isMedicine ? 'Medicine' : 'Service'}
                          </span>
                          {line.rxId && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded font-medium">Rx</span>
                          )}
                        </div>

                        {isMedicine && !line.rxId ? (
                          <>
                            <select
                              value={line.inventoryItemId || ''}
                              onChange={e => handleMedicineSelect(line.id, e.target.value)}
                              className="input-field text-sm py-2 w-full"
                            >
                              <option value="">Select medicine from inventory…</option>
                              {inventoryItems
                                .slice()
                                .sort((a, b) => (b.quantity > 0 ? 1 : -1) - (a.quantity > 0 ? 1 : -1) || a.name.localeCompare(b.name))
                                .map(inv => (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.name}{inv.potency ? ` (${inv.potency})` : ''}{inv.dosageForm ? ` · ${inv.dosageForm}` : ''} — {inv.quantity} {inv.unit || 'units'} {inv.quantity === 0 ? '(out of stock)' : ''}
                                  </option>
                                ))
                              }
                            </select>
                            {linkedInv && (linkedInv.mrp || linkedInv.billingPrice) && (
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                {linkedInv.mrp && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">Purchase: <span className="font-semibold text-gray-600 dark:text-gray-300">₹{linkedInv.mrp}</span></span>
                                )}
                                {linkedInv.billingPrice && (
                                  <span className="text-xs text-teal-600 dark:text-teal-400">Billing: <span className="font-semibold">₹{linkedInv.billingPrice}</span></span>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <ServiceSuggest
                            value={line.description}
                            onChange={desc => updateLine(line.id, 'description', desc)}
                            onSelect={(name, price) => selectService(line.id, name, price)}
                            services={doctor?.serviceCharges ?? []}
                            readOnly={!!line.rxId}
                            className={`input-field text-sm py-2 w-full ${line.rxId ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400' : ''}`}
                          />
                        )}
                      </div>

                      {/* Tax toggle */}
                      <div className="col-span-1 pt-7 flex justify-center">
                        <button type="button"
                          title={line.taxable !== false ? 'Click to exempt from tax' : 'Click to apply tax'}
                          onClick={() => updateLine(line.id, 'taxable', line.taxable !== false ? false : true)}
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                            line.taxable !== false
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}>
                          {line.taxable !== false
                            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          }
                        </button>
                      </div>

                      {/* Discount toggle */}
                      <div className="col-span-1 pt-7 flex flex-col items-center gap-1">
                        <button type="button"
                          title={line.discountPct > 0 ? 'Remove item discount' : 'Add item discount (%)'}
                          onClick={() => updateLine(line.id, 'discountPct', line.discountPct > 0 ? 0 : 10)}
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors text-xs font-bold ${
                            line.discountPct > 0
                              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}>
                          %
                        </button>
                        {line.discountPct > 0 && (
                          <input
                            type="number" min="0" max="100"
                            value={line.discountPct}
                            onChange={e => updateLine(line.id, 'discountPct', e.target.value)}
                            className="w-12 text-center text-xs py-1 border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-400"
                          />
                        )}
                      </div>

                      {/* Qty */}
                      <div className="col-span-2 pt-7">
                        <input type="number" min="1"
                          value={line.quantity}
                          onChange={e => updateLine(line.id, 'quantity', e.target.value)}
                          className="input-field text-sm py-2 text-center w-full"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2 pt-7">
                        <input type="number" min="0" step="0.01"
                          value={line.unitPrice}
                          onChange={e => updateLine(line.id, 'unitPrice', e.target.value)}
                          placeholder="0"
                          className="input-field text-sm py-2 w-full"
                        />
                      </div>

                      {/* Total */}
                      <div className="col-span-1 pt-8 text-right">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {formatCurrency(line.total)}
                        </span>
                        {line.discountPct > 0 && (
                          <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">-{line.discountPct}%</p>
                        )}
                      </div>

                      {/* Delete */}
                      <div className="col-span-1 pt-8 flex justify-center">
                        {invoiceLines.length > 1 && (
                          <button type="button"
                            onClick={() => setInvoiceLines(ls => ls.filter(l => l.id !== line.id))}
                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Totals */}
              <div className="border-t dark:border-gray-700 pt-4 space-y-2">
                <div className="grid grid-cols-2 gap-4 max-w-xs ml-auto">
                  <div>
                    <label className="form-label text-xs">Tax Rate (%)</label>
                    <input type="number" min="0" max="100" value={payment.taxRate}
                      onChange={e => setPayment(p => ({ ...p, taxRate: e.target.value }))}
                      className="input-field py-2 text-sm"/>
                  </div>
                  <div>
                    <label className="form-label text-xs">Discount (₹)</label>
                    <input type="number" min="0" value={payment.discount}
                      onChange={e => setPayment(p => ({ ...p, discount: e.target.value }))}
                      className="input-field py-2 text-sm"/>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 mt-4 text-sm">
                  <div className="flex gap-8 text-gray-600 dark:text-gray-300">
                    <span>Subtotal</span>
                    <span className="font-medium w-28 text-right">{formatCurrency(invoiceSubtotal)}</span>
                  </div>
                  {invoiceTaxAmount > 0 && (
                    <div className="flex gap-8 text-gray-600 dark:text-gray-300">
                      <span>
                        Tax ({payment.taxRate}%)
                        {taxableSubtotal < invoiceSubtotal && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">on {formatCurrency(taxableSubtotal)}</span>
                        )}
                      </span>
                      <span className="font-medium w-28 text-right">{formatCurrency(invoiceTaxAmount)}</span>
                    </div>
                  )}
                  {Number(payment.discount) > 0 && (
                    <div className="flex gap-8 text-green-600 dark:text-green-400">
                      <span>Discount</span>
                      <span className="font-medium w-28 text-right">-{formatCurrency(Number(payment.discount))}</span>
                    </div>
                  )}
                  <div className="flex gap-8 font-bold text-base border-t dark:border-gray-700 pt-2 text-gray-900 dark:text-white">
                    <span>Total</span>
                    <span className="w-28 text-right text-primary-600 dark:text-primary-400">{formatCurrency(invoiceTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Simple mode ── */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Amount (₹) <span className="text-red-500">*</span></label>
                  <input type="number" min="0" value={payment.amount}
                    onChange={e => setPayment(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0" className="input-field"/>
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <input value={payment.description}
                    onChange={e => setPayment(p => ({ ...p, description: e.target.value }))}
                    placeholder="Consultation Fee" className="input-field"/>
                </div>
              </div>
              {Number(payment.amount) > 0 && (
                <div className={`rounded-xl px-4 py-3 flex items-center justify-between border ${
                  payment.status === 'paid'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800'
                }`}>
                  <span className={`text-sm font-medium ${payment.status === 'paid' ? 'text-green-800 dark:text-green-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                    {payment.status === 'paid' ? 'Amount collected' : 'Amount due (unpaid)'}
                  </span>
                  <span className={`text-xl font-bold ${payment.status === 'paid' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                    ₹{Number(payment.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Shared payment meta */}
          <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Payment Status <span className="text-red-500">*</span></label>
                <div className={`flex rounded-lg border overflow-hidden text-sm font-medium ${!payment.status ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-600'}`}>
                  <button type="button" onClick={() => setPayment(p => ({ ...p, status: 'paid' }))}
                    className={`flex-1 py-2 transition-colors flex items-center justify-center gap-1.5 ${payment.status === 'paid' ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                    Paid
                  </button>
                  <button type="button" onClick={() => setPayment(p => ({ ...p, status: 'draft' }))}
                    className={`flex-1 py-2 transition-colors flex items-center justify-center gap-1.5 ${payment.status === 'draft' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Due
                  </button>
                </div>
                {!payment.status && <p className="text-xs text-red-500 mt-1">Required — select Paid or Due</p>}
              </div>

              <div>
                <label className="form-label">Payment Method <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PAYMENT_METHODS.map(m => (
                    <button type="button" key={m.value}
                      onClick={() => setPayment(p => ({ ...p, method: p.method === m.value ? '' : m.value }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        payment.method === m.value
                          ? 'bg-primary-500 text-white border-primary-500'
                          : !payment.method
                            ? 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-red-200 dark:border-red-700 hover:border-primary-400'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400'
                      }`}>{m.label}</button>
                  ))}
                </div>
                {!payment.method && <p className="text-xs text-red-500 mt-1">Required — select a method</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>{/* spacer */}</div>
              <div>
                <label className="form-label">Collected By</label>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm font-medium">
                  {COLLECTED_BY_OPTIONS.map(o => (
                    <button type="button" key={o.value}
                      onClick={() => setPayment(p => ({ ...p, collectedBy: o.value }))}
                      className={`flex-1 py-2 transition-colors text-center ${
                        payment.collectedBy === o.value
                          ? 'bg-primary-500 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}>{o.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {saveError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {saveError}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => requestLeave(() => router.back())}
            className="px-5 py-2.5 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSaveDraft}
            disabled={savingDraft || saving || !patientId}
            className="px-5 py-2.5 border border-amber-300 dark:border-amber-600 text-sm font-medium text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
            {savingDraft && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {savingDraft ? 'Saving…' : draftSaved ? '✓ Draft Saved' : 'Save as Draft'}
          </button>
          <button onClick={handleSave}
            disabled={saving || !form.chiefComplaint.trim() || !patientId || !form.followUpDate || !payment.method || !payment.status || (useInvoice ? invoiceTotal <= 0 : (!payment.amount || Number(payment.amount) <= 0))}
            className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
            {saving && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {saving ? 'Saving…' : isDraft ? 'Complete Visit' : 'Save Visit'}
          </button>
        </div>
      </div>{/* end form column */}

      {/* ── Right: Visit History ── */}
      <div className="xl:sticky xl:top-4 space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Visit History</h3>
            {!visitsLoading && (
              <span className="text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                {pastVisits.length} {pastVisits.length === 1 ? 'visit' : 'visits'}
              </span>
            )}
          </div>

          {!patientId ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 p-4 text-center">Select a patient to see history</p>
          ) : visitsLoading ? (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {[1,2,3].map(i => (
                <div key={i} className="p-4 space-y-2 animate-pulse">
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24"/>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-40"/>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-32"/>
                </div>
              ))}
            </div>
          ) : pastVisits.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">No previous visits</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
              {pastVisits.map(v => {
                const vDate = v.visitDate ? new Date(v.visitDate) : null
                const dateStr = vDate
                  ? vDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'
                const vitals = v.examination?.vitalSigns ?? {}
                const vitalPairs = [
                  ['BP', vitals.bloodPressure],
                  ['HR', vitals.heartRate ? `${vitals.heartRate} bpm` : ''],
                  ['Temp', vitals.temperature ? `${vitals.temperature}°C` : ''],
                  ['Wt', vitals.weight ? `${vitals.weight} kg` : ''],
                  ['Ht', vitals.height ? `${vitals.height} cm` : ''],
                  ['SpO₂', vitals.oxygenSat ? `${vitals.oxygenSat}%` : ''],
                ].filter(([, val]) => val)
                const isExpanded = expandedVisitId === v.id
                return (
                  <div key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    {/* Header row — always visible, click to expand */}
                    <button
                      type="button"
                      onClick={() => setExpandedVisitId(isExpanded ? null : v.id)}
                      className="w-full text-left p-4 pb-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">{dateStr}</p>
                        <div className="flex items-center gap-1.5">
                          {v.followUpDate && (
                            <span className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded font-medium">
                              FU {new Date(v.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          <svg className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                          </svg>
                        </div>
                      </div>
                      {v.chiefComplaint && (
                        <p className="text-xs text-gray-800 dark:text-gray-200 font-medium leading-snug mb-1.5">
                          {v.chiefComplaint}
                        </p>
                      )}
                      {/* Diagnosis chips — always visible */}
                      {(v.diagnosis ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {v.diagnosis.map(d => (
                            <span key={d} className="text-[10px] px-1.5 py-0.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded font-medium">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Quick badge summary when collapsed */}
                      {!isExpanded && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(v.prescriptions ?? []).length > 0 && (
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded font-medium">
                              {v.prescriptions.length} Rx
                            </span>
                          )}
                          {(v.labOrders ?? []).length > 0 && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded font-medium">
                              {v.labOrders.length} Lab
                            </span>
                          )}
                          {vitalPairs.slice(0, 2).map(([lbl, val]) => (
                            <span key={lbl} className="text-[10px] text-gray-400 dark:text-gray-500">{lbl} {val}</span>
                          ))}
                        </div>
                      )}
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-50 dark:border-gray-700/50 pt-3">

                        {v.history && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">History</p>
                            {v.history.trimStart().startsWith('<')
                              ? <div className="rich-text-view text-xs leading-snug" dangerouslySetInnerHTML={{ __html: v.history }}/>
                              : <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug">{v.history}</p>}
                          </div>
                        )}

                        {v.examination?.findings && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Findings</p>
                            {v.examination.findings.trimStart().startsWith('<')
                              ? <div className="rich-text-view text-xs leading-snug" dangerouslySetInnerHTML={{ __html: v.examination.findings }}/>
                              : <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug">{v.examination.findings}</p>}
                          </div>
                        )}

                        {v.treatment && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Treatment</p>
                            {v.treatment.trimStart().startsWith('<')
                              ? <div className="rich-text-view text-xs leading-snug" dangerouslySetInnerHTML={{ __html: v.treatment }}/>
                              : <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug">{v.treatment}</p>}
                          </div>
                        )}

                        {(v.prescriptions ?? []).length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Prescriptions</p>
                            <div className="space-y-1.5">
                              {v.prescriptions.map(rx => (
                                <div key={rx.id} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-2.5 py-1.5">
                                  <p className="text-xs font-semibold text-purple-800 dark:text-purple-300">{rx.medication} {rx.dosage && `— ${rx.dosage}`}</p>
                                  {(rx.frequency || rx.duration) && (
                                    <p className="text-[10px] text-purple-600 dark:text-purple-400">{[rx.frequency, rx.duration].filter(Boolean).join(' · ')}</p>
                                  )}
                                  {rx.instructions && (
                                    <p className="text-[10px] text-purple-500 dark:text-purple-500 italic">{rx.instructions}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(v.labOrders ?? []).length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Lab Orders</p>
                            <div className="flex flex-wrap gap-1">
                              {v.labOrders.map(l => (
                                <span key={l} className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded font-medium">
                                  {l}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {vitalPairs.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Vitals</p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              {vitalPairs.map(([lbl, val]) => (
                                <div key={lbl} className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 w-10 flex-shrink-0">{lbl}</span>
                                  <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{val}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {v.notes && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Notes</p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug">{v.notes}</p>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      </div>{/* end grid */}
      </div>{/* end max-w-6xl */}

      <Modal open={!!pendingNav} onClose={() => setPendingNav(null)} title="Leave without finishing?" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          This visit hasn't been saved yet. Save it as a draft so you can pick up where you left off, or discard your changes.
        </p>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={saveDraftAndLeave} disabled={leavingSaving}
            className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {leavingSaving ? 'Saving…' : 'Save as Draft & Leave'}
          </button>
          <button type="button" onClick={() => { pendingNav?.(); setPendingNav(null) }} disabled={leavingSaving}
            className="px-4 py-2.5 border border-red-200 dark:border-red-800 text-sm font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-colors">
            Discard Changes
          </button>
          <button type="button" onClick={() => setPendingNav(null)} disabled={leavingSaving}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-60 transition-colors">
            Keep Editing
          </button>
        </div>
      </Modal>
    </AppLayout>
  )
}

export default function NewVisitPage() {
  return (
    <Suspense>
      <VisitEntryForm />
    </Suspense>
  )
}
