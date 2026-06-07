'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { dataStore } from '@/lib/dataStore'
import { formatCurrency as fmtCurrencyLib } from '@/lib/preferences'

function useTodayRevenue(doctor) {
  const [revenue, setRevenue] = useState(null)
  useEffect(() => {
    if (!doctor) return
    const today = new Date().toISOString().slice(0, 10)
    const unsub = dataStore.subscribe('invoices', (invoices) => {
      const total = invoices
        .filter(i => i.status === 'paid' && i.issueDate === today)
        .reduce((s, i) => s + (i.total ?? 0), 0)
      setRevenue(total)
    })
    return () => unsub()
  }, [doctor])
  return revenue
}

const navSections = [
  {
    label: 'Main',
    items: [
      {
        href: '/dashboard', label: 'Dashboard',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
      },
      {
        href: '/calendar', label: 'Calendar',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
      },
    ],
  },
  {
    label: 'Clinical',
    items: [
      {
        href: '/patients', label: 'Patients',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
      },
      {
        href: '/contacts', label: 'Contacts',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
      },
      {
        href: '/appointments', label: 'Appointments',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
      },
      {
        href: '/follow-ups', label: 'Follow-ups',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        href: '/billing', label: 'Billing',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
      },
      {
        href: '/expenses', label: 'Expenses',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
      },
      {
        href: '/reports', label: 'Reports', doctorOnly: true,
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
      },
    ],
  },
  {
    label: 'Team',
    items: [
      {
        href: '/staff', label: 'Staff',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>,
      },
      {
        href: '/notifications', label: 'Notifications', badge: true,
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        href: '/inventory', label: 'Inventory',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>,
      },
      {
        href: '/whatsapp-templates', label: 'WhatsApp Templates',
        icon: <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
      },
      {
        href: '/pricing', label: 'Subscription', doctorOnly: true,
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
      },
      {
        href: '/settings', label: 'Settings',
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
      },
      {
        href: '/admin', label: 'Admin Panel', adminOnly: true,
        icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
      },
    ],
  },
]

export default function Sidebar({ unreadCount = 0, open = false, onClose }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { doctor, logout, isReceptionist, org, activeBranch, switchBranch, baseDoctor } = useAuth()
  const todayRevenue = useTodayRevenue(doctor)
  const [branchOpen, setBranchOpen] = useState(false)

  const handleLogout = () => { logout(); router.push('/login') }

  const initials = isReceptionist
    ? (doctor?._receptionistName ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
    : doctor
      ? `${doctor.firstName?.[0] ?? ''}${doctor.lastName?.[0] ?? ''}`.toUpperCase() || '?'
      : '?'

  const isActive = (href) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  const handleNavClick = () => {
    if (onClose) onClose()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-primary-900 flex flex-col h-screen
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:w-60 lg:flex-shrink-0
      `}>

        {/* Logo / clinic name */}
        <div className="px-4 py-4 border-b border-primary-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
              </svg>
            </div>
            <div className="min-w-0">
              {doctor?.clinicName ? (
                <>
                  <p className="text-white font-bold text-sm leading-tight truncate">{doctor.clinicName}</p>
                  <p className="text-primary-300 text-xs truncate">ClinicCRM</p>
                </>
              ) : (
                <span className="text-white font-bold text-lg">ClinicCRM</span>
              )}
            </div>
          </div>
          {/* Close button — mobile only */}
          <button onClick={onClose}
            className="lg:hidden text-primary-300 hover:text-white p-1 rounded transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Branch switcher — only visible when doctor belongs to an org */}
        {org && !isReceptionist && !doctor?.isAdmin && (
          <div className="px-3 py-2 border-b border-primary-800 relative">
            <button
              onClick={() => setBranchOpen(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-800/60 hover:bg-primary-700/60 transition-colors text-left">
              <svg className="w-3.5 h-3.5 text-primary-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary-400 leading-none mb-0.5">Branch</p>
                <p className="text-white text-xs font-semibold truncate">
                  {activeBranch?.branchName ?? baseDoctor?.branchName ?? 'Main Branch'}
                </p>
              </div>
              <svg className={`w-3 h-3 text-primary-400 flex-shrink-0 transition-transform ${branchOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {branchOpen && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-primary-800 rounded-xl shadow-xl border border-primary-700 overflow-hidden z-10">
                {/* Own branch */}
                <button
                  onClick={() => { switchBranch(null); setBranchOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-primary-700 transition-colors ${!activeBranch ? 'bg-primary-700/60' : ''}`}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-green-400"/>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{baseDoctor?.branchName ?? 'My Branch'}</p>
                    <p className="text-xs text-primary-400 truncate">{baseDoctor?.clinicName || 'Own clinic'}</p>
                  </div>
                  {!activeBranch && <svg className="w-3 h-3 text-green-400 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                </button>
                {/* Other branches */}
                {(org.branches ?? [])
                  .filter(b => b.uid !== baseDoctor?.id)
                  .map(b => (
                    <button key={b.uid}
                      onClick={() => { switchBranch(b); setBranchOpen(false) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-primary-700 transition-colors border-t border-primary-700/50 ${activeBranch?.uid === b.uid ? 'bg-primary-700/60' : ''}`}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-primary-400"/>
                      <p className="text-xs font-semibold text-white truncate flex-1">{b.branchName}</p>
                      {activeBranch?.uid === b.uid && <svg className="w-3 h-3 text-green-400 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navSections.map(section => {
            const visibleItems = section.items.filter(item => {
              if (item.adminOnly && !doctor?.isAdmin) return false
              if (item.doctorOnly && isReceptionist) return false
              if (doctor?.isAdmin && !item.adminOnly) return false
              return true
            })
            if (visibleItems.length === 0) return null
            return (
              <div key={section.label}>
                <p className="px-3 mb-1.5 text-[10px] font-bold text-white/50 uppercase tracking-widest">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map(item => {
                    const active = isActive(item.href)
                    return (
                      <Link key={item.href} href={item.href} onClick={handleNavClick}
                        className={active
                          ? 'flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-600 text-white font-semibold text-sm'
                          : 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/75 hover:bg-primary-700 hover:text-white font-medium text-sm transition-colors'
                        }
                      >
                        {item.icon}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Profile footer */}
        <div className="px-4 py-4 border-t border-primary-800">
          <div className="flex items-center gap-3">
            <Link href="/profile" onClick={handleNavClick}
              className="flex items-center gap-3 flex-1 min-w-0 rounded-lg hover:bg-primary-700/60 transition-colors -mx-2 px-2 py-1">
              <div className="w-9 h-9 bg-primary-700 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-primary-100 font-bold text-sm">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {isReceptionist ? doctor?._receptionistName : `Dr. ${doctor?.firstName} ${doctor?.lastName}`}
                </p>
                <p className="text-xs text-primary-300 truncate">
                  {isReceptionist
                    ? <span className="text-primary-400">Receptionist</span>
                    : todayRevenue !== null
                      ? <>Today: <span className="text-green-400 font-semibold">{fmtCurrencyLib(todayRevenue, doctor?.currency ?? 'INR')}</span></>
                      : <span className="capitalize">{doctor?.specialization?.replace(/_/g, ' ')}</span>
                  }
                </p>
              </div>
            </Link>
            <button onClick={handleLogout} title="Sign out"
              className="text-primary-400 hover:text-red-400 transition-colors p-1 rounded flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
