import { dataStore } from '@/lib/dataStore'
import { createProgressNote } from '@/models/ProgressNote'

// Progress notes are stored as a subcollection: patients/{patientId}/progressNotes
function notePath(patientId) {
  return `patients/${patientId}/progressNotes`
}

export const progressNoteService = {
  async getForPatient(patientId) {
    const notes = await dataStore.getAll(notePath(patientId))
    return notes.sort((a, b) => (b.noteDate ?? '').localeCompare(a.noteDate ?? ''))
  },

  async create(data) {
    const note = createProgressNote(data)
    return dataStore.create(notePath(note.patientId), note)
  },

  async update(id, patch, patientId) {
    return dataStore.update(notePath(patientId), id, patch)
  },

  async remove(id, patientId) {
    return dataStore.remove(notePath(patientId), id)
  },
}
