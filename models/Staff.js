let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const STAFF_ROLES = [
  { value: 'receptionist',    label: 'Receptionist' },
  { value: 'nurse',           label: 'Nurse' },
  { value: 'lab_technician',  label: 'Lab Technician' },
  { value: 'pharmacist',      label: 'Pharmacist' },
  { value: 'admin',           label: 'Admin' },
  { value: 'other',           label: 'Other' },
]

export const STAFF_STATUSES = [
  { value: 'active',     label: 'Active',    color: 'green' },
  { value: 'on_leave',   label: 'On Leave',  color: 'yellow' },
  { value: 'terminated', label: 'Terminated', color: 'red' },
]

export function createStaff(data = {}) {
  const now = new Date().toISOString()
  return {
    id:        data.id ?? uid(),
    doctorId:  data.doctorId ?? '',
    firstName: data.firstName ?? '',
    lastName:  data.lastName ?? '',
    role:      data.role ?? 'receptionist',
    email:     data.email ?? '',
    phone:     data.phone ?? '',
    schedule: {
      workDays:  data.schedule?.workDays ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: data.schedule?.startTime ?? '09:00',
      endTime:   data.schedule?.endTime ?? '17:00',
    },
    status:    data.status ?? 'active',
    joinDate:  data.joinDate ?? now.slice(0, 10),
    notes:     data.notes ?? '',
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  }
}

export function getStaffRoleLabel(role) {
  return STAFF_ROLES.find(r => r.value === role)?.label ?? role
}

export function getStaffFullName(staff) {
  return `${staff.firstName} ${staff.lastName}`.trim()
}
