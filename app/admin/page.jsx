'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import {
  collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, limit as fsLimit,
} from 'firebase/firestore'

// Admin panel reads from the root 'users' collection (all doctors)
// Access requires doctor.isAdmin === true

async function getAllDoctors() {
  if (!db) return []
  try {
    const snap = await getDocs(collection(db, 'users'))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch {
    return []
  }
}

async function getDoctorStats(doctorId) {
  if (!db) return {}
  const getCount = async (collName) => {
    try {
      const snap = await getDocs(collection(db, 'users', doctorId, collName))
      return snap.size
    } catch { return 0 }
  }
  const [patients, appointments, invoices, followups] = await Promise.all([
    getCount('patients'),
    getCount('appointments'),
    getCount('invoices'),
    getCount('followups'),
  ])
  return { patients, appointments, invoices, followups }
}

async function setAdminFlag(doctorId, isAdmin) {
  if (!db) return
  const ref = doc(db, 'users', doctorId)
  await setDoc(ref, { isAdmin }, { merge: true })
}

function StatPill({ label, value, color }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.blue}`}>
      {value} {label}
    </span>
  )
}

export default function AdminPage() {
  const { doctor } = useAuth()
  const router = useRouter()

  const [doctors, setDoctors]     = useState([])
  const [stats,   setStats]       = useState({})
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMsg,   setInviteMsg]   = useState('')

  // Guard: only admin can see this
  if (doctor && !doctor.isAdmin) {
    return (
      <AppLayout title="Admin Panel">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm mb-6">
            You need administrator privileges to access this panel. Contact your system administrator.
          </p>
          <button onClick={() => router.push('/dashboard')}
            className="px-5 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors">
            Back to Dashboard
          </button>
        </div>
      </AppLayout>
    )
  }

  useEffect(() => {
    if (!doctor?.isAdmin) return
    setLoading(true)
    getAllDoctors().then(async (list) => {
      setDoctors(list)
      // Load stats for all doctors in parallel (up to 10 to avoid rate limits)
      const statsMap = {}
      await Promise.all(list.slice(0, 10).map(async d => {
        statsMap[d.id] = await getDoctorStats(d.id)
      }))
      setStats(statsMap)
      setLoading(false)
    })
  }, [doctor])

  const handleToggleAdmin = async (docId, currentVal) => {
    await setAdminFlag(docId, !currentVal)
    setDoctors(prev => prev.map(d => d.id === docId ? { ...d, isAdmin: !currentVal } : d))
  }

  const handleInvite = () => {
    if (!inviteEmail.trim()) return
    const subject = encodeURIComponent('Invitation to join ClinicCRM')
    const body = encodeURIComponent(`You have been invited to join ClinicCRM.\n\nPlease sign up at the application using this email address: ${inviteEmail}\n\nOnce registered, the admin will grant you full access.\n\nThank you!`)
    window.open(`mailto:${inviteEmail}?subject=${subject}&body=${body}`)
    setInviteMsg(`Invite email opened for ${inviteEmail}`)
    setTimeout(() => setInviteMsg(''), 3000)
  }

  return (
    <AppLayout title="Admin Panel">
      <div className="space-y-6">

        {/* Stats overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Doctors',  value: doctors.length,                                              color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800' },
            { label: 'Total Patients', value: Object.values(stats).reduce((s,v) => s+(v.patients||0),0),    color: 'text-green-600 dark:text-green-400',    bg: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
            { label: 'Appointments',  value: Object.values(stats).reduce((s,v) => s+(v.appointments||0),0), color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
            { label: 'Invoices',      value: Object.values(stats).reduce((s,v) => s+(v.invoices||0),0),     color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Invite new doctor */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Invite New Doctor</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            Send an invitation email. The doctor should sign up at the app with this email — they will automatically be registered.
          </p>
          <div className="flex gap-3 max-w-lg">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="doctor@example.com"
              className="input-field flex-1"
            />
            <button onClick={handleInvite}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
              Send Invite
            </button>
          </div>
          {inviteMsg && (
            <p className="text-sm text-green-700 dark:text-green-400 mt-2">{inviteMsg}</p>
          )}
        </div>

        {/* Doctor list */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">All Registered Doctors</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-3">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Loading doctors…
            </div>
          ) : doctors.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">No doctors registered yet.</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {doctors.map(d => {
                const s = stats[d.id] || {}
                const initials = `${d.firstName?.[0]??''}${d.lastName?.[0]??''}`.toUpperCase() || '?'
                const isMe = d.id === doctor?.id
                return (
                  <div key={d.id} className={`px-6 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors ${isMe ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-700 dark:text-primary-300 font-bold text-sm">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            Dr. {d.firstName} {d.lastName}
                            {isMe && <span className="ml-1 text-xs text-primary-500">(You)</span>}
                          </p>
                          {d.isAdmin && (
                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-semibold">Admin</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {d.email} · {d.clinicName || 'No clinic'} · {d.specialization || 'General'}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <StatPill label="patients"     value={s.patients     ?? '…'} color="blue"/>
                          <StatPill label="appointments" value={s.appointments ?? '…'} color="green"/>
                          <StatPill label="invoices"     value={s.invoices     ?? '…'} color="orange"/>
                          <StatPill label="follow-ups"   value={s.followups    ?? '…'} color="purple"/>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!isMe && (
                          <button
                            onClick={() => handleToggleAdmin(d.id, d.isAdmin)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors
                              ${d.isAdmin
                                ? 'border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            {d.isAdmin ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Security Note</p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Admin access requires configuring Firestore security rules to restrict who can read the root <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">users</code> collection.
            Ensure only admin UIDs can list all users. For production, use Firebase Admin SDK or Cloud Functions to manage users securely.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
