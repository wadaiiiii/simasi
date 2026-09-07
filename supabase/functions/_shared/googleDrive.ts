const encoder = new TextEncoder()

async function tokenFromOAuthRefreshToken() {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
  const refreshToken = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN')

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('SIMASI Google Drive OAuth is not configured')
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Google OAuth token refresh failed (${res.status}): ${detail.slice(0, 220)}`)
  }

  const data = await res.json()
  if (!data.access_token) throw new Error('Google OAuth did not return an access token')
  return data.access_token as string
}

export async function getDriveToken() {
  return await tokenFromOAuthRefreshToken()
}

function q(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}

export async function verifyFolderAccess(token: string, folderId: string) {
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,driveId,capabilities(canAddChildren,canEdit)',
    supportsAllDrives: 'true'
  })
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Google Drive root folder access failed (${res.status}): ${detail.slice(0, 220)}`)
  }
  const folder = await res.json()
  if (folder.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Configured Drive root is not a folder')
  if (!folder.capabilities?.canAddChildren) throw new Error('FMIPA OAuth account cannot add files to the configured SIMASI root folder')
  return folder
}

export async function findOrCreateFolder(token: string, name: string, parentId: string) {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${q(name)}' and '${q(parentId)}' in parents and trashed=false`
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,driveId)',
    pageSize: '10',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true'
  })
  const search = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!search.ok) {
    const detail = await search.text()
    throw new Error(`Google Drive folder lookup failed (${search.status}): ${detail.slice(0, 220)}`)
  }
  const found = await search.json()
  if (found.files?.[0]?.id) return found.files[0].id as string

  const create = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,driveId&supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
  })
  if (!create.ok) {
    const detail = await create.text()
    throw new Error(`Google Drive folder creation failed (${create.status}): ${detail.slice(0, 220)}`)
  }
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

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents,driveId&supportsAllDrives=true', {
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
