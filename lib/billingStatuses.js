export const DEFAULT_BILLING_STATUSES = [
  { value: 'draft',     label: 'Due',       color: 'orange' },
  { value: 'sent',      label: 'Sent',      color: 'blue'   },
  { value: 'paid',      label: 'Paid',      color: 'green'  },
  { value: 'overdue',   label: 'Overdue',   color: 'red'    },
  { value: 'cancelled', label: 'Cancelled', color: 'yellow' },
]

export const BILLING_STATUS_COLORS = ['orange', 'blue', 'green', 'red', 'yellow', 'gray', 'teal', 'purple']

/**
 * Returns active billing statuses — custom ones from doctor profile, or defaults.
 */
export function getBillingStatuses(custom) {
  if (Array.isArray(custom) && custom.length > 0) return custom
  return DEFAULT_BILLING_STATUSES
}

/**
 * Build a value→color map for badge rendering.
 */
export function buildStatusColorMap(statuses) {
  const map = {}
  statuses.forEach(s => { map[s.value] = s.color })
  return map
}
