const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID

if (!clientId || !clientSecret || !refreshToken || !folderId) {
  console.error('Missing Google Drive OAuth environment variables.')
  process.exit(1)
}

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })
})

if (!tokenResponse.ok) {
  const detail = await tokenResponse.text()
  console.error(`Google OAuth refresh failed (${tokenResponse.status}): ${detail.slice(0, 500)}`)
  process.exit(1)
}

const { access_token: token } = await tokenResponse.json()
if (!token) {
  console.error('Google OAuth did not return an access token.')
  process.exit(1)
}

const params = new URLSearchParams({
  fields: 'id,name,mimeType,capabilities(canAddChildren,canEdit)',
  supportsAllDrives: 'true'
})
const folderResponse = await fetch(
  `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?${params}`,
  { headers: { Authorization: `Bearer ${token}` } }
)

if (!folderResponse.ok) {
  const detail = await folderResponse.text()
  console.error(`FMIPA OAuth account cannot access SIMASI root folder (${folderResponse.status}): ${detail.slice(0, 800)}`)
  process.exit(1)
}

const folder = await folderResponse.json()
if (folder.mimeType !== 'application/vnd.google-apps.folder') {
  console.error('GOOGLE_DRIVE_ROOT_FOLDER_ID does not point to a Google Drive folder.')
  process.exit(1)
}
if (!folder.capabilities?.canAddChildren) {
  console.error('FMIPA OAuth account can see SIMASI folder but cannot add files.')
  process.exit(1)
}

console.log(`OK: FMIPA OAuth can write to configured SIMASI root: ${folder.name} (${folder.id}).`)
