let _counter = 0
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createPrescription(data = {}) {
  return {
    id:           data.id ?? uid(),
    medication:   data.medication ?? '',
    dosage:       data.dosage ?? '',
    frequency:    data.frequency ?? '',
    duration:     data.duration ?? '',
    instructions: data.instructions ?? '',
  }
}

export function createVisitRecord(data = {}) {
  const now = new Date().toISOString()
  return {
    id:            data.id ?? uid(),
    doctorId:      data.doctorId ?? '',
    patientId:     data.patientId ?? '',
    patientName:   data.patientName ?? '',
    appointmentId: data.appointmentId ?? null,
    visitDate:     data.visitDate ?? now,
    patientPhone:  data.patientPhone ?? '',
    status:        data.status ?? 'completed',

    chiefComplaint: data.chiefComplaint ?? '',
    history:        data.history ?? '',

    examination: {
      vitalSigns: {
        bloodPressure: data.examination?.vitalSigns?.bloodPressure ?? '',
        heartRate:     data.examination?.vitalSigns?.heartRate ?? '',
        temperature:   data.examination?.vitalSigns?.temperature ?? '',
        weight:        data.examination?.vitalSigns?.weight ?? '',
        height:        data.examination?.vitalSigns?.height ?? '',
        oxygenSat:     data.examination?.vitalSigns?.oxygenSat ?? '',
      },
      findings: data.examination?.findings ?? '',
    },

    diagnosis:     data.diagnosis ?? [],
    treatment:     data.treatment ?? '',

    prescriptions: (data.prescriptions ?? []).map(createPrescription),
    labOrders:     data.labOrders ?? [],

    followUpDate:  data.followUpDate ?? null,
    notes:         data.notes ?? '',

    createdAt: data.createdAt ?? now,
    updatedAt: now,
  }
}
