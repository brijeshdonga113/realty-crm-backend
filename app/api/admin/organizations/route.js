import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

async function verifyAdmin(request) {
  const idToken = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!idToken) return null
  const adminAuth = await getAdminAuth()
  let decoded
  try { decoded = await adminAuth.verifyIdToken(idToken) } catch { return null }
  const db   = getAdminDb()
  const snap = await db.collection('users').doc(decoded.uid).collection('profile').doc('doctor').get()
  return snap.data()?.isAdmin ? decoded : null
}

// GET — list all organizations
export async function GET(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db   = getAdminDb()
  const snap = await db.collection('organizations').orderBy('createdAt', 'desc').get()

  const orgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  return Response.json({ orgs })
}

// POST — create a new organization
export async function POST(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, branches } = await request.json()
  if (!name?.trim()) return Response.json({ error: 'Organization name is required.' }, { status: 400 })
  if (!Array.isArray(branches) || branches.length < 1) {
    return Response.json({ error: 'At least one branch is required.' }, { status: 400 })
  }

  const db  = getAdminDb()
  const now = new Date().toISOString()

  const ref = db.collection('organizations').doc()
  const org = { name: name.trim(), branches, createdAt: now, updatedAt: now }
  await ref.set(org)

  // Update each branch clinic's profile with organizationId
  await Promise.all(
    branches.map(b =>
      db.collection('users').doc(b.uid).collection('profile').doc('doctor')
        .update({ organizationId: ref.id, branchName: b.branchName })
        .catch(() => {})
    )
  )

  return Response.json({ id: ref.id, ...org })
}

// PATCH — update organization (rename or change branches)
export async function PATCH(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, branches } = await request.json()
  if (!id) return Response.json({ error: 'Organization id required.' }, { status: 400 })

  const db      = getAdminDb()
  const orgRef  = db.collection('organizations').doc(id)
  const orgSnap = await orgRef.get()
  if (!orgSnap.exists) return Response.json({ error: 'Not found.' }, { status: 404 })

  const prev    = orgSnap.data()
  const updates = { updatedAt: new Date().toISOString() }
  if (name)     updates.name     = name.trim()
  if (branches) updates.branches = branches

  await orgRef.update(updates)

  // If branches changed, sync organizationId on doctor profiles
  if (branches) {
    const prevUids = (prev.branches ?? []).map(b => b.uid)
    const nextUids = branches.map(b => b.uid)

    // Remove from branches that were removed
    const removed = prevUids.filter(u => !nextUids.includes(u))
    await Promise.all(removed.map(u =>
      db.collection('users').doc(u).collection('profile').doc('doctor')
        .update({ organizationId: null, branchName: '' })
        .catch(() => {})
    ))

    // Add/update branches
    await Promise.all(
      branches.map(b =>
        db.collection('users').doc(b.uid).collection('profile').doc('doctor')
          .update({ organizationId: id, branchName: b.branchName })
          .catch(() => {})
      )
    )
  }

  return Response.json({ ok: true })
}

// DELETE — remove an organization
export async function DELETE(request) {
  const caller = await verifyAdmin(request)
  if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'id required.' }, { status: 400 })

  const db      = getAdminDb()
  const orgSnap = await db.collection('organizations').doc(id).get()
  if (!orgSnap.exists) return Response.json({ error: 'Not found.' }, { status: 404 })

  // Clear organizationId from all branch profiles
  const branches = orgSnap.data()?.branches ?? []
  await Promise.all(branches.map(b =>
    db.collection('users').doc(b.uid).collection('profile').doc('doctor')
      .update({ organizationId: null, branchName: '' })
      .catch(() => {})
  ))

  await db.collection('organizations').doc(id).delete()
  return Response.json({ ok: true })
}
