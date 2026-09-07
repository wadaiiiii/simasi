import { createSign } from 'node:crypto'

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replaceAll('\\n', '\n')
const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID

if (!email || !privateKey || !folderId) {
  console.error('Missing Google Drive service-account environment variables.')
  process.exit(1)
}

const b64url = (value) => Buffer.from(value).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
const payload = b64url(JSON.stringify({
  iss: email,
  scope: 'https://www.googleapis.com/auth/drive',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600
}))
const unsigned = `${header}.${payload}`
const signer = createSign('RSA-SHA256')
signer.update(unsigned)
signer.end()
const assertion = `${unsigned}.${signer.sign(privateKey).toString('base64url')}`

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  })
})

if (!tokenResponse.ok) {
  const detail = await tokenResponse.text()
  console.error(`Google service-account authentication failed (${tokenResponse.status}): ${detail.slice(0, 500)}`)
  process.exit(1)
}

const { access_token: token } = await tokenResponse.json()
const folderResponse = await fetch(
  `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,capabilities(canAddChildren,canEdit)`,
  { headers: { Authorization: `Bearer ${token}` } }
)

if (!folderResponse.ok) {
  const detail = await folderResponse.text()
  console.error(`Service account cannot access SIMASI root folder (${folderResponse.status}): ${detail.slice(0, 800)}`)
  process.exit(1)
}

const folder = await folderResponse.json()
if (folder.mimeType !== 'application/vnd.google-apps.folder') {
  console.error('GOOGLE_DRIVE_ROOT_FOLDER_ID does not point to a Google Drive folder.')
  process.exit(1)
}
if (!folder.capabilities?.canAddChildren) {
  console.error('Service account can see the folder but cannot add children. Share SIMASI folder as Editor.')
  process.exit(1)
}

console.log(`OK: service account can write only where Drive permissions allow. Root verified: ${folder.name} (${folder.id}).`)
