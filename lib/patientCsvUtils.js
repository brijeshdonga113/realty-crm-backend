/**
 * Patient CSV export / import utilities.
 *
 * CSV layout: one row per visit. Patients with no visits get one row with
 * empty visit columns. On import, rows are grouped by patientKey
 * (email if present, else firstName+lastName+DOB) to reconstruct patient +
 * all their visit records.
 *
 * Array fields  → pipe-separated          e.g.  "Flu|Hypertension"
 * Prescriptions → each rx = fields joined by "|", multiple rx joined by ";;"
 *                 e.g.  "Amoxicillin|500mg|TID|7 days|Take with food;;Ibuprofen|400mg|BID|5 days|"
 */

// ─── CSV primitives ──────────────────────────────────────────────────────────

function esc(v) {
  const s = v == null ? '' : String(v).replace(/\n/g, '\\n')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function row(...cells) {
  return cells.map(esc).join(',')
}

function parseArr(cell) {
  return cell ? cell.split('|').map(s => s.trim()).filter(Boolean) : []
}

function parseRx(cell) {
  if (!cell) return []
  return cell.split(';;').map(block => {
    const [medication = '', dosage = '', frequency = '', duration = '', instructions = ''] = block.split('|')
    return { medication: medication.trim(), dosage: dosage.trim(), frequency: frequency.trim(), duration: duration.trim(), instructions: instructions.trim() }
  }).filter(rx => rx.medication)
}

function serializeRx(prescriptions = []) {
  return prescriptions.map(rx =>
    [rx.medication, rx.dosage, rx.frequency, rx.duration, rx.instructions].join('|')
  ).join(';;')
}

// ─── Column header ────────────────────────────────────────────────────────────

export const CSV_HEADERS = [
  // Patient info
  'UHID', 'First Name', 'Last Name', 'Date of Birth', 'Gender', 'Blood Type', 'National ID',
  'Phone', 'Alternate Phone', 'Email', 'Address',
  'Allergies', 'Chronic Conditions', 'Current Medications', 'Family History',
  'Emergency Contact Name', 'Emergency Contact Phone', 'Emergency Contact Relationship',
  'Insurance Provider', 'Insurance Policy Number', 'Insurance Expiry', 'Insurance Group Number',
  'Referral Source', 'Referral Notes',
  'Status', 'Patient Notes',
  // Visit info
  'Visit Date',
  'Chief Complaint', 'History',
  'Blood Pressure', 'Heart Rate', 'Temperature', 'Weight', 'Height', 'Oxygen Saturation',
  'Clinical Findings',
  'Diagnosis', 'Treatment Plan',
  'Prescriptions',
  'Lab Orders',
  'Follow-up Date', 'Visit Notes',
]

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Generate CSV string from patients + their visits.
 * @param {object[]} patients
 * @param {object[]} allVisits  - flat array of all visits across all patients
 */
export function exportPatientsCsv(patients, allVisits) {
  const visitsByPatient = {}
  allVisits.forEach(v => {
    if (!visitsByPatient[v.patientId]) visitsByPatient[v.patientId] = []
    visitsByPatient[v.patientId].push(v)
  })

  const lines = [CSV_HEADERS.join(',')]

  patients.forEach(p => {
    const patientCells = [
      p.patientNumber ?? '',
      p.firstName, p.lastName,
      p.dateOfBirth ?? '', p.gender ?? '', p.bloodType ?? '', p.nationalId ?? '',
      p.phone ?? '', p.alternatePhone ?? '', p.email ?? '', p.address ?? '',
      (p.allergies ?? []).join('|'),
      (p.chronicConditions ?? []).join('|'),
      (p.currentMedications ?? []).join('|'),
      p.familyHistory ?? '',
      p.emergencyContact?.name ?? '', p.emergencyContact?.phone ?? '', p.emergencyContact?.relationship ?? '',
      p.insuranceProvider ?? '', p.insurancePolicyNumber ?? '', p.insuranceExpiry ?? '', p.insuranceGroupNumber ?? '',
      p.referralSource ?? '', p.referralNotes ?? '',
      p.status ?? 'active', p.notes ?? '',
    ]

    const visits = visitsByPatient[p.id] ?? []
    if (visits.length === 0) {
      lines.push(row(...patientCells, ...Array(CSV_HEADERS.length - patientCells.length).fill('')))
    } else {
      visits.forEach(v => {
        lines.push(row(
          ...patientCells,
          v.visitDate ?? '',
          v.chiefComplaint ?? '', v.history ?? '',
          v.examination?.vitalSigns?.bloodPressure ?? '',
          v.examination?.vitalSigns?.heartRate ?? '',
          v.examination?.vitalSigns?.temperature ?? '',
          v.examination?.vitalSigns?.weight ?? '',
          v.examination?.vitalSigns?.height ?? '',
          v.examination?.vitalSigns?.oxygenSat ?? '',
          v.examination?.findings ?? '',
          (v.diagnosis ?? []).join('|'),
          v.treatment ?? '',
          serializeRx(v.prescriptions ?? []),
          (v.labOrders ?? []).join('|'),
          v.followUpDate ?? '', v.notes ?? '',
        ))
      })
    }
  })

  return lines.join('\r\n')
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const cells = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuote = false
      else cur += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { cells.push(cur.replace(/\\n/g, '\n')); cur = '' }
      else cur += ch
    }
  }
  cells.push(cur.replace(/\\n/g, '\n'))
  return cells
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim() })
    return obj
  })
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into { patients, visits } ready for Firestore creation.
 * Patients are de-duplicated by email (preferred) or firstName+lastName+DOB.
 * Returns:
 *   patients: createPatient-compatible objects (no id — caller assigns)
 *   visits:   createVisitRecord-compatible objects, keyed by patientKey
 *             (caller maps patientKey → created patient id)
 */
export function importPatientsCsv(csvText) {
  const rows = parseCsv(csvText)
  if (!rows.length) throw new Error('CSV is empty or has no data rows.')

  const patientMap = new Map()   // patientKey → patient data
  const visitMap   = new Map()   // patientKey → visit[]

  rows.forEach((r, idx) => {
    const firstName = r['First Name']?.trim() || ''
    const lastName  = r['Last Name']?.trim()  || ''
    const email     = r['Email']?.trim().toLowerCase() || ''
    const dob       = r['Date of Birth']?.trim() || ''

    if (!firstName && !lastName) return  // skip blank rows

    const key = email || `${firstName.toLowerCase()}__${lastName.toLowerCase()}__${dob}`

    if (!patientMap.has(key)) {
      patientMap.set(key, {
        firstName, lastName,
        dateOfBirth:    dob,
        gender:         r['Gender']?.toLowerCase() || 'male',
        bloodType:      r['Blood Type'] || '',
        nationalId:     r['National ID'] || '',
        phone:          r['Phone'] || '',
        alternatePhone: r['Alternate Phone'] || '',
        email:          r['Email'] || '',
        address:        r['Address'] || '',
        allergies:          parseArr(r['Allergies']),
        chronicConditions:  parseArr(r['Chronic Conditions']),
        currentMedications: parseArr(r['Current Medications']),
        familyHistory:  r['Family History'] || '',
        emergencyContact: {
          name:         r['Emergency Contact Name'] || '',
          phone:        r['Emergency Contact Phone'] || '',
          relationship: r['Emergency Contact Relationship'] || '',
        },
        insuranceProvider:     r['Insurance Provider'] || '',
        insurancePolicyNumber: r['Insurance Policy Number'] || '',
        insuranceExpiry:       r['Insurance Expiry'] || '',
        insuranceGroupNumber:  r['Insurance Group Number'] || '',
        referralSource:  r['Referral Source'] || '',
        referralNotes:   r['Referral Notes'] || '',
        status:          r['Status'] || 'active',
        notes:           r['Patient Notes'] || '',
      })
      visitMap.set(key, [])
    }

    const visitDate = r['Visit Date']?.trim()
    if (visitDate) {
      visitMap.get(key).push({
        visitDate,
        chiefComplaint: r['Chief Complaint'] || '',
        history:        r['History'] || '',
        examination: {
          vitalSigns: {
            bloodPressure: r['Blood Pressure'] || '',
            heartRate:     r['Heart Rate'] || '',
            temperature:   r['Temperature'] || '',
            weight:        r['Weight'] || '',
            height:        r['Height'] || '',
            oxygenSat:     r['Oxygen Saturation'] || '',
          },
          findings: r['Clinical Findings'] || '',
        },
        diagnosis:    parseArr(r['Diagnosis']),
        treatment:    r['Treatment Plan'] || '',
        prescriptions: parseRx(r['Prescriptions']),
        labOrders:    parseArr(r['Lab Orders']),
        followUpDate: r['Follow-up Date'] || null,
        notes:        r['Visit Notes'] || '',
      })
    }
  })

  return { patientMap, visitMap }
}
