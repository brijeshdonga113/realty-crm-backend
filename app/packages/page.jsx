'use client'
import { useMemo, useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useRequireModuleAccess } from '@/hooks/useRequireModuleAccess'
import { useAuth } from '@/context/AuthContext'
import { usePatients } from '@/hooks/usePatients'
import { usePackageTemplates, usePatientPackages } from '@/hooks/usePackages'
import { usePreferences } from '@/hooks/usePreferences'
import { getPackageStatusMeta, summarizePackage } from '@/models/Package'
import { AssignPackageModal } from '@/components/packages/AssignPackageModal'
import { PackageDetailModal, PackageProgress } from '@/components/packages/PackageDetailModal'
import { PackageReminders, packageReminderDueCount } from '@/components/packages/PackageReminders'
import { TemplateFormModal } from '@/components/packages/TemplateFormModal'

function tabFromSearch(searchParams) {
  const t = searchParams.get('tab')
  if (t === 'bundles' || t === 'reminders') return t
  return 'patients'
}

function PackagesPageInner() {
  useRequireModuleAccess('packages')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { doctor } = useAuth()
  const { formatCurrency } = usePreferences()
  const { patients } = usePatients()
  const { templates, loading: templatesLoading, add: addTemplate, update: updateTemplate, remove: removeTemplate } = usePackageTemplates()
  const {
    packages, loading,
    add, update, markInstallment, unmarkInstallment, addPayment, removePayment, cancel, remove,
  } = usePatientPackages()

  const [pageTab, setPageTab]         = useState(() => tabFromSearch(searchParams))
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [assignOpen, setAssignOpen]   = useState(false)
  const [assignPatientId, setAssignPatientId] = useState(searchParams.get('patientId') ?? '')
  const [assignTemplateId, setAssignTemplateId] = useState('')
  const [detail, setDetail]           = useState(null)
  const [templateForm, setTemplateForm] = useState(null) // null | { open, initial }
  const [deleteTemplateId, setDeleteTemplateId] = useState(null)

  useEffect(() => {
    if (searchParams.get('assign') === '1') {
      setAssignOpen(true)
      setAssignPatientId(searchParams.get('patientId') ?? '')
    }
    setPageTab(tabFromSearch(searchParams))
  }, [searchParams])

  const liveDetail = detail ? (packages.find(p => p.id === detail.id) ?? detail) : null
  const reminderDueCount = useMemo(() => packageReminderDueCount(packages), [packages])

  const goTab = (id) => {
    setPageTab(id)
    router.replace(id === 'patients' ? '/packages' : `/packages?tab=${id}`)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return packages.filter(pkg => {
      if (filterStatus !== 'all' && (pkg.status || summarizePackage(pkg).status) !== filterStatus) return false
      if (!q) return true
      return (
        (pkg.patientName || '').toLowerCase().includes(q) ||
        (pkg.name || '').toLowerCase().includes(q) ||
        (pkg.patientPhone || '').includes(q)
      )
    })
  }, [packages, search, filterStatus])

  const stats = useMemo(() => {
    return packages.reduce((acc, pkg) => {
      const s = summarizePackage(pkg)
      const status = pkg.status || s.status
      if (status === 'active') { acc.active += 1; acc.outstanding += s.remaining }
      if (status === 'completed') acc.completed += 1
      acc.collected += s.paidTotal
      return acc
    }, { active: 0, completed: 0, collected: 0, outstanding: 0 })
  }, [packages])

  const openAssign = (patientId = '', templateId = '') => {
    if (doctor?.viewOnly) {
      alert('Assigning packages is restricted on your current plan. Contact your administrator to upgrade.')
      return
    }
    setAssignPatientId(patientId)
    setAssignTemplateId(templateId)
    setAssignOpen(true)
  }

  return (
    <AppLayout
      title="Packages"
      action={
        !doctor?.viewOnly && (
          <div className="flex items-center gap-2">
            {pageTab === 'bundles' ? (
              <button onClick={() => setTemplateForm({ open: true, initial: null })}
                className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                New Bundle
              </button>
            ) : (
              <button onClick={() => openAssign()}
                className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                Assign Package
              </button>
            )}
          </div>
        )
      }
    >
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl w-fit flex-wrap">
          {[
            { id: 'patients',  label: 'Patient Packages' },
            { id: 'reminders', label: 'Reminders' },
            { id: 'bundles',   label: 'Bundle Deals' },
          ].map(t => (
            <button key={t.id} onClick={() => goTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                pageTab === t.id
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}>
              {t.label}
              {t.id === 'reminders' && reminderDueCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                  {reminderDueCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {pageTab === 'patients' && (
          <>
            {packages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Active',       value: stats.active,                     sub: 'in progress' },
                  { label: 'Collected',    value: formatCurrency(stats.collected),  sub: 'marked so far' },
                  { label: 'Outstanding',  value: formatCurrency(stats.outstanding), sub: 'still due' },
                  { label: 'Completed',    value: stats.completed,                  sub: 'fully paid' },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex flex-wrap gap-3 items-center">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search patient or package…"
                className="input-field py-1.5 text-sm w-56 flex-shrink-0"/>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field py-1.5 text-sm w-40">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {(search || filterStatus !== 'all') && (
                <button onClick={() => { setSearch(''); setFilterStatus('all') }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1">
                  Clear
                </button>
              )}
              <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                {filtered.length} package{filtered.length !== 1 ? 's' : ''}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16 text-gray-400 text-sm gap-3">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Loading packages…
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                <EmptyState
                  title={packages.length === 0 ? 'No patient packages yet' : 'No packages match your filters'}
                  description={packages.length === 0
                    ? 'Create a bundle deal, then assign it to a patient to track installments as they pay.'
                    : 'Try a different search or status.'}
                  action={!doctor?.viewOnly && packages.length === 0 ? () => openAssign() : undefined}
                  actionLabel="Assign Package"
                />
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(pkg => {
                  const summary = summarizePackage(pkg)
                  const status  = getPackageStatusMeta(pkg.status || summary.status)
                  return (
                    <button key={pkg.id} onClick={() => setDetail(pkg)}
                      className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 hover:border-primary-200 dark:hover:border-primary-700 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{pkg.patientName || 'Patient'}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{pkg.name}</p>
                        </div>
                        <Badge label={status.label} color={status.color}/>
                      </div>
                      <PackageProgress paidTotal={summary.paidTotal} totalAmount={pkg.totalAmount ?? 0} compact/>
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatCurrency(summary.paidTotal)} collected of {formatCurrency(pkg.totalAmount ?? 0)}</span>
                        <span className={`font-bold ${summary.remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                          {summary.remaining > 0 ? `${formatCurrency(summary.remaining)} remaining` : 'Paid in full'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {pageTab === 'reminders' && (
          <PackageReminders
            packages={packages}
            patients={patients}
            doctor={doctor}
            loading={loading}
            viewOnly={!!doctor?.viewOnly}
            onAssign={() => openAssign()}
            onOpenPackage={(id) => {
              const pkg = packages.find(p => p.id === id)
              if (pkg) setDetail(pkg)
            }}
          />
        )}

        {pageTab === 'bundles' && (
          <>
            {templatesLoading ? (
              <div className="flex justify-center py-16 text-gray-400 text-sm">Loading bundle deals…</div>
            ) : templates.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                <EmptyState
                  title="No bundle deals yet"
                  description="Save reusable packages — name, total, and installment count — then assign them to patients."
                  action={!doctor?.viewOnly ? () => setTemplateForm({ open: true, initial: null }) : undefined}
                  actionLabel="New Bundle"
                />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {templates.map(tmpl => (
                  <div key={tmpl.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{tmpl.name}</p>
                        {tmpl.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{tmpl.description}</p>}
                      </div>
                      {tmpl.active === false && <Badge label="Archived" color="gray"/>}
                    </div>
                    <p className="text-lg font-bold text-primary-600 dark:text-primary-400 mt-3">{formatCurrency(tmpl.totalAmount ?? 0)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {tmpl.installmentCount} installment{tmpl.installmentCount !== 1 ? 's' : ''}
                      {tmpl.sessionCount ? ` · ${tmpl.sessionCount} sessions` : ''}
                    </p>
                    {!doctor?.viewOnly && (
                      <div className="flex items-center gap-2 mt-4">
                        <button onClick={() => openAssign('', tmpl.id)}
                          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                          Assign
                        </button>
                        <button onClick={() => setTemplateForm({ open: true, initial: tmpl })}
                          className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                          Edit
                        </button>
                        <button onClick={() => updateTemplate(tmpl.id, { active: tmpl.active === false })}
                          className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                          {tmpl.active === false ? 'Restore' : 'Archive'}
                        </button>
                        <button onClick={() => setDeleteTemplateId(tmpl.id)}
                          className="text-xs font-medium text-red-500 hover:text-red-700 ml-auto">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AssignPackageModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        patients={patients}
        templates={templates}
        defaultPatientId={assignPatientId}
        defaultTemplateId={assignTemplateId}
        viewOnly={!!doctor?.viewOnly}
        onSave={add}
      />

      <PackageDetailModal
        pkg={liveDetail}
        onClose={() => setDetail(null)}
        onMark={markInstallment}
        onUnmark={unmarkInstallment}
        onAddPayment={addPayment}
        onRemovePayment={removePayment}
        onCancel={cancel}
        onDelete={remove}
        onUpdate={update}
        viewOnly={!!doctor?.viewOnly}
      />

      <TemplateFormModal
        open={!!templateForm?.open}
        onClose={() => setTemplateForm(null)}
        initial={templateForm?.initial ?? null}
        viewOnly={!!doctor?.viewOnly}
        onSave={async (data) => {
          if (templateForm?.initial?.id) await updateTemplate(templateForm.initial.id, data)
          else await addTemplate(data)
        }}
      />

      {deleteTemplateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Delete bundle deal?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Patient packages already assigned from this deal are not deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTemplateId(null)}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg">
                Cancel
              </button>
              <button onClick={async () => { await removeTemplate(deleteTemplateId); setDeleteTemplateId(null) }}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

export default function PackagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading…</div>
    }>
      <PackagesPageInner />
    </Suspense>
  )
}
