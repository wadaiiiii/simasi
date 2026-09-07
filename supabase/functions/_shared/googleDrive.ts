const encoder = new TextEncoder()

function b64url(bytes: Uint8Array | string) {
  const raw = typeof bytes === 'string' ? encoder.encode(bytes) : bytes
  let binary = ''
  for (const byte of raw) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function pemToArrayBuffer(pem: string) {
  const clean = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function tokenFromServiceAccount() {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replaceAll('\\n', '\n')
  if (!email || !privateKey) throw new Error('SIMASI Google Drive service account is not configured')

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: email,
    // Scope Drive penuh hanya berlaku untuk resource yang memang dapat diakses
    // oleh service account. Folder lain milik FMIPA tidak otomatis terbuka.
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }))
  const unsigned = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned)))
  const assertion = `${unsigned}.${b64url(signature)}`
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) throw new Error(`Google service account token failed (${res.status})`)
  const data = await res.json()
  return data.access_token as string
}

export async function getDriveToken() {
  return await tokenFromServiceAccount()
}

function q(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}

export async function verifyFolderAccess(token: string, folderId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,capabilities(canAddChildren,canEdit)`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`Google Drive root folder access failed (${res.status})`)
  const folder = await res.json()
  if (folder.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Configured Drive root is not a folder')
  if (!folder.capabilities?.canAddChildren) throw new Error('SIMASI service account does not have permission to add files to the Drive root folder')
  return folder
}

export async function findOrCreateFolder(token: string, name: string, parentId: string) {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${q(name)}' and '${q(parentId)}' in parents and trashed=false`
  const search = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=10`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!search.ok) throw new Error(`Google Drive folder lookup failed (${search.status})`)
  const found = await search.json()
  if (found.files?.[0]?.id) return found.files[0].id as string

  const create = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
  })
  if (!create.ok) throw new Error(`Google Drive folder creation failed (${create.status})`)
  const folder = await create.json()
  return folder.id as string
}

export async function uploadFile(token: string, folderId: string, file: File, fileName: string) {
  const boundary = `simasi_${crypto.randomUUID()}`
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: fileName, parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`
  )
  const bodyBytes = new Uint8Array(await file.arrayBuffer())
  const suffix = encoder.encode(`\r\n--${boundary}--`)
  const body = new Uint8Array(prefix.length + bodyBytes.length + suffix.length)
  body.set(prefix, 0)
  body.set(bodyBytes, prefix.length)
  body.set(suffix, prefix.length + bodyBytes.length)

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Google Drive upload failed (${res.status}): ${detail.slice(0, 220)}`)
  }
  return await res.json()
}
