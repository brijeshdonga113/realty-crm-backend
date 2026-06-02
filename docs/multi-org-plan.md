# Multi-Doctor Organization Support — Implementation Plan

## Overview

Allow multiple doctors to operate under a single organization, sharing patient data across branches while maintaining separate calendars, billing, expenses, and inventory per doctor.

**Key decisions:**
- Shared patients under `organizations/{orgId}/patients/` — branch filter at app level
- Per-doctor billing, expenses, inventory, appointments — unchanged
- Org mode is opt-in — solo doctors see zero difference
- Multiple receptionists per doctor already works — no changes needed

---

## Target Data Structure

```
organizations/{orgId}
  name, ownerId, createdAt
  branches: [{ id, name, location }]
  members/{doctorId}
    role: 'admin' | 'doctor'
    branchId: string
    name, email, joinedAt
  patients/{patientId}
    (same shape as current patient + branchId)
    visits/{visitId}
      doctorId  ← which doctor recorded this visit
      (rest same as current visit)
  invites/{code}
    email, role, branchId, invitedBy, createdAt, used: bool

users/{doctorId}/appointments/   ← stays (separate calendar per doctor)
users/{doctorId}/profile/doctor  ← stays (add orgId: string | null)
users/{doctorId}/invoices/       ← stays (per-doctor billing)
users/{doctorId}/expenses/       ← stays (per-doctor expenses)
users/{doctorId}/inventory/      ← stays (per-doctor inventory)
```

---

## Build Order

### Step 1 — `lib/orgStore.js` (NEW)

Mirror of `dataStore.js` but all paths rooted at `organizations/{orgId}/`.
Takes `orgId` as first argument on every method.

```js
export const orgStore = {
  getAll(orgId, collPath),
  getById(orgId, collPath, id),
  create(orgId, collPath, record),       // does NOT auto-inject doctorId
  update(orgId, collPath, id, patch),
  remove(orgId, collPath, id),
  subscribe(orgId, collPath, callback),  // returns unsubscribe fn
  getMeta(orgId, key),
  setMeta(orgId, key, value),
}
```

`getCollectionRef(orgId, collPath)` builds path: `organizations/{orgId}/{collPath}`

Patient counter must be org-level: `orgStore.getMeta(orgId, 'patientCounter')`
so two doctors don't both generate patient #2045.

---

### Step 2 — `services/orgService.js` (NEW) + Firestore rules

```js
export const orgService = {
  async createOrg(doctorId, { name, branchName, branchLocation }),
  // 1. Write organizations/{orgId} doc
  // 2. Write organizations/{orgId}/members/{doctorId} as admin
  // 3. setDoc users/{doctorId}/profile/doctor { orgId } merge:true

  async createInvite(orgId, invitingDoctorId, { email, role, branchId }),
  // Returns invite URL: /organization/join?orgId=xxx&code=yyy

  async acceptInvite(orgId, code, doctorId, doctorName, doctorEmail),
  // 1. Validate invite exists and used:false
  // 2. Write organizations/{orgId}/members/{doctorId}
  // 3. Mark invite used:true
  // 4. setDoc users/{doctorId}/profile/doctor { orgId } merge:true

  async getOrg(orgId),
  async getMembers(orgId),
  async addBranch(orgId, { name, location }),
  async updateBranch(orgId, branchId, patch),
  async removeBranch(orgId, branchId),
  async updateMemberBranch(orgId, memberId, branchId),
  async removeMember(orgId, memberId),
  // Removes member doc + clears orgId from their doctor profile
}
```

**Firestore rules to add** (after the `bookingSlugs` block):

```
match /organizations/{orgId} {
  function isOrgMember(orgId) {
    return request.auth != null
      && exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
  }
  function isOrgAdmin(orgId) {
    return isOrgMember(orgId)
      && get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role == 'admin';
  }

  allow read: if isOrgMember(orgId);
  allow create: if request.auth != null
    && request.resource.data.ownerId == request.auth.uid;
  allow update, delete: if isOrgAdmin(orgId);

  match /members/{memberId} {
    allow read: if isOrgMember(orgId);
    allow create, update, delete: if isOrgAdmin(orgId);
    allow update: if request.auth != null && request.auth.uid == memberId
      && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']);
  }

  match /patients/{patientId} {
    allow read, create, update: if isOrgMember(orgId);
    allow delete: if isOrgAdmin(orgId);

    match /visits/{visitId} {
      allow read: if isOrgMember(orgId);
      allow create: if isOrgMember(orgId)
        && request.resource.data.doctorId == request.auth.uid;
      allow update, delete: if isOrgMember(orgId);
    }
  }

  match /invites/{code} {
    allow read: if request.auth != null;
    allow create, update: if isOrgMember(orgId);
    allow delete: if isOrgAdmin(orgId);
  }
}
```

> **Gotcha — wildcard visits rule conflict**: The existing `/{path=**}/visits/{visitId}` rule
> checks `resource.data.doctorId == request.auth.uid`. Org visits would fail this because
> doctor B can read doctor A's visits. Firestore evaluates the most specific match first,
> so the explicit org visits block above takes precedence. Verify this in the rules playground.

---

### Step 3 — `context/OrgContext.jsx` (NEW) + patch `AuthContext.jsx` + `app/layout.jsx`

**`AuthContext.jsx` change:**
Add `orgId: data.orgId ?? null` to `buildDoctorProfile` so it loads from Firestore
and is available synchronously from the localStorage session cache.

**`OrgContext.jsx` state shape:**

```js
{
  orgId: string | null,         // null = solo mode (zero behaviour change)
  org: { name, ownerId, branches, createdAt } | null,
  userBranchId: string | null,  // this doctor's assigned branch
  isOrgAdmin: boolean,
  orgMembers: [{ doctorId, role, branchId, name, email, joinedAt }],
  orgBranches: [{ id, name, location }],

  // UI filter — persisted to localStorage key 'clinic_crm_branch_filter'
  activeBranchFilter: 'all' | string,
  setActiveBranchFilter: fn,

  loading: boolean,

  // Actions
  createOrg, inviteDoctor, acceptInvite,
  addBranch, updateBranch, removeBranch,
  updateMemberBranch, removeMember,
  reloadOrg,
}
```

Load sequence on `doctor` change:
1. If `doctor === null` or `doctor._role === 'receptionist'` → all null, return
   (Receptionist inherits org via their linked doctor's orgId — works automatically)
2. If `doctor.orgId` is null → solo mode, all null, return
3. Load `organizations/{orgId}` doc + subscribe to `members/{doctorId}` doc
4. Restore `activeBranchFilter` from localStorage

**`app/layout.jsx` change:**
```jsx
<AuthProvider>
  <OrgProvider>          {/* NEW */}
    <NotificationsProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </NotificationsProvider>
  </OrgProvider>
</AuthProvider>
```

**Hook export:**
```js
export function useOrg() { return useContext(OrgContext) }
```
Returns safe defaults when `orgId` is null so every consumer can simply `if (orgId)` guard.

---

### Step 4 — `app/organization/page.jsx` (NEW)

**States based on membership:**
- No org → "Create Organization" form + "Join with invite code" input
- Member (non-admin) → read-only: org name, branch assignment, member list
- Admin → full management UI

**Admin UI sections:**
1. Org header — name, member count, branch count
2. Branches panel — list with Add / Edit / Remove (admin only)
3. Members table — name, email, role badge, branch selector, Remove button
4. Invite panel — email + role + branch → generates `/organization/join?orgId=&code=` link with Copy button; list of pending invites

---

### Step 5 — `app/organization/join/page.jsx` (NEW)

Analogous to `app/signup/receptionist/page.jsx`.
Accepts an already-logged-in doctor joining an org.

URL params: `?orgId=xxx&code=yyy`

Flow:
1. On mount: fetch `organizations/{orgId}/invites/{code}` — validate not used, check email matches
2. Show org name, inviting doctor, branch assignment
3. "Accept Invite" button → `orgService.acceptInvite(...)` → `reloadOrg()` → redirect to `/dashboard`
4. Handle already-a-member gracefully (idempotent)

---

### Step 6 — Patient service routing

**`services/patientService.js`** — add factory alongside existing methods:

```js
// Existing solo methods stay unchanged

export function createOrgPatientService(orgId) {
  return {
    async getAll()          { return orgStore.getAll(orgId, 'patients') },
    async getById(id)       { return orgStore.getById(orgId, 'patients', id) },
    async create(data)      { return orgStore.create(orgId, 'patients', { id: uid(), ...data }) },
    async update(id, patch) { return orgStore.update(orgId, 'patients', id, patch) },
    async remove(id)        { return orgStore.remove(orgId, 'patients', id) },
    // nextPatientNumber uses orgStore.getMeta(orgId, 'patientCounter')
  }
}
```

**`hooks/usePatients.js`** — branch on `orgId`:

```js
export function usePatients() {
  const { doctor } = useAuth()
  const { orgId, activeBranchFilter, userBranchId } = useOrg()

  useEffect(() => {
    if (!doctor) return
    if (orgId) {
      const unsub = orgStore.subscribe(orgId, 'patients', data => {
        const filtered = activeBranchFilter === 'all'
          ? data
          : data.filter(p => p.branchId === activeBranchFilter)
        setPatients(filtered.sort(...))
        setLoading(false)
      })
      return () => unsub()
    } else {
      // original solo behaviour — unchanged
      const unsub = dataStore.subscribe('patients', ...)
      return () => unsub()
    }
  }, [doctor, orgId, activeBranchFilter])

  const add = useCallback(async data => {
    if (orgId) {
      const svc = createOrgPatientService(orgId)
      return svc.create({ ...data, doctorId: doctor.id, branchId: data.branchId ?? userBranchId })
    }
    return patientService.create({ ...data, doctorId: doctor.id })
  }, [doctor, orgId, userBranchId])
}
```

**`hooks/usePatients.js` — `usePatient(id)` single-patient hook:**

Must wait for `OrgContext.loading === false` before fetching,
then route to `orgStore.getById` vs `patientService.getById`.

**`models/Patient.js`** — add `branchId: data.branchId ?? null` to `createPatient`.

---

### Step 7 — Visit service routing

**`services/visitService.js`** — add factory:

```js
export function createOrgVisitService(orgId) {
  return {
    async getForPatient(patientId) {
      return orgStore.getAll(orgId, `patients/${patientId}/visits`)
    },
    async create(data) {
      // data must include patientId and doctorId
      return orgStore.create(orgId, `patients/${data.patientId}/visits`, { id: uid(), ...data, orgId })
      // Also write recentVisits meta to users/{doctorId}/meta (per-doctor denorm stays)
    },
    async update(id, patch, patientId) {
      return orgStore.update(orgId, `patients/${patientId}/visits`, id, patch)
    },
    async saveDraft(data, draftId) { /* same pattern */ },
  }
}
```

**`hooks/useVisits.js`** — same `if (orgId)` branch pattern as `usePatients`.

**`app/patients/[id]/page.jsx`** — in org mode, show "Dr. [name]" attribution chip on each
visit card. Map `visit.doctorId` → `orgMembers` to get the name.

---

### Step 8 — Sidebar branch filter + patient list

**`components/Sidebar.jsx`:**

1. Add "Organization" nav item in the System section (doctor-only):
```js
{ href: '/organization', label: 'Organization', doctorOnly: true,
  icon: <svg>...building icon...</svg> }
```

2. Add branch filter below nav when in org mode with multiple branches:
```jsx
{orgId && orgBranches.length > 1 && (
  <div className="px-3 py-3 border-t border-primary-800">
    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Branch</p>
    <button onClick={() => setActiveBranchFilter('all')}>All Branches</button>
    {orgBranches.map(b => (
      <button key={b.id} onClick={() => setActiveBranchFilter(b.id)}>{b.name}</button>
    ))}
  </div>
)}
```

**`app/patients/page.jsx`** — in org mode:
- Show branch badge on each patient row
- Show "recorded by Dr. X" on recent visits

---

### Step 9 — Polish

- **`app/patients/new/page.jsx`** — add Branch select field (populated from `orgBranches`,
  pre-filled with `userBranchId`) when in org mode
- **CSV import** — the import handler calls `patientService.create()` directly; in org mode
  must call `createOrgPatientService(orgId).create()` instead. Check for `orgId` in the import handler.
- **Dashboard org stats** — `visitService.getDashboardStats` uses `getAllGroup('visits')` filtered
  by `doctorId`. In org mode, optionally show org-wide stats by querying with `orgId` field filter
  (requires storing `orgId` on each org visit record and adding a Firestore index).

---

## Known Gotchas

| # | Issue | Fix |
|---|-------|-----|
| 1 | Patient counter must be org-global | Use `orgStore.getMeta(orgId, 'patientCounter')` instead of per-doctor meta |
| 2 | Wildcard visits rule blocks org member reads | More specific org path rule takes precedence — verify in rules playground |
| 3 | After `createOrg` / `acceptInvite`, session cache is stale | Call `AuthContext.updateProfile({ orgId })` to sync localStorage session |
| 4 | `usePatient(id)` must wait for `OrgContext.loading` | Add `loading` guard before fetching to avoid fetching from wrong path |
| 5 | CSV import calls `patientService.create()` directly | Route through org factory when `orgId` present |
| 6 | `recentVisits` meta stays per-doctor | Org visit service still writes to `users/{doctorId}/meta` — correct behaviour |
| 7 | Receptionists in org mode | Inherit org via linked doctor's `orgId` automatically — no changes needed |
| 8 | `diff()` in Firestore rules security | `request.resource.data.diff(resource.data)` syntax — test in rules emulator |

---

## Files Summary

| File | Action | Notes |
|------|--------|-------|
| `lib/orgStore.js` | NEW | Firestore layer for org paths |
| `services/orgService.js` | NEW | Create org, invite, accept, branch CRUD |
| `context/OrgContext.jsx` | NEW | Org state, branch filter, actions |
| `app/organization/page.jsx` | NEW | Org management UI |
| `app/organization/join/page.jsx` | NEW | Accept invite page |
| `firestore.rules` | MODIFY | Add org rules block |
| `context/AuthContext.jsx` | MODIFY | Add `orgId` to `buildDoctorProfile` |
| `app/layout.jsx` | MODIFY | Wrap with `OrgProvider` |
| `services/patientService.js` | MODIFY | Add `createOrgPatientService` factory |
| `services/visitService.js` | MODIFY | Add `createOrgVisitService` factory |
| `hooks/usePatients.js` | MODIFY | Branch on `orgId` from `OrgContext` |
| `hooks/useVisits.js` | MODIFY | Branch on `orgId` from `OrgContext` |
| `models/Patient.js` | MODIFY | Add `branchId` field |
| `components/Sidebar.jsx` | MODIFY | Org nav item + branch filter UI |
| `app/patients/page.jsx` | MODIFY | Branch badge, doctor attribution |
| `app/patients/[id]/page.jsx` | MODIFY | Visit doctor attribution chip |
| `app/patients/new/page.jsx` | MODIFY | Branch select field in org mode |
| `app/patients/[id]/edit/page.jsx` | MODIFY | Branch select field in org mode |
| `firestore.indexes.json` | MODIFY | Index for `orgId` on visits collection group |

**Total: 5 new files, 14 modified files**
