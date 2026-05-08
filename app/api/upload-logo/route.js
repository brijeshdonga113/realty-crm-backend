import { put } from '@vercel/blob'

const ALLOWED_TYPES = new Set(['image/svg+xml', 'image/png'])
const MAX_BYTES = 2 * 1024 * 1024

export async function POST(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[upload-logo] BLOB_READ_WRITE_TOKEN is not set')
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const file     = formData.get('file')
    const doctorId = formData.get('doctorId')

    if (!file || !doctorId) {
      return Response.json({ error: 'Missing file or doctorId.' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: 'Only SVG and PNG files are accepted.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'File must be smaller than 2 MB.' }, { status: 400 })
    }

    const ext  = file.type === 'image/svg+xml' ? 'svg' : 'png'
    const blob = await put(`logos/${doctorId}/clinic-logo.${ext}`, file, {
      access:          'public',
      addRandomSuffix: false,
    })

    return Response.json({ url: blob.url })
  } catch (err) {
    console.error('[upload-logo]', err)
    return Response.json({ error: 'Upload failed.' }, { status: 500 })
  }
}
