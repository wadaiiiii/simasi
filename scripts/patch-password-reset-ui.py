from pathlib import Path

# Landing: turn the old inert forgot-password text into the reset-request flow.
p = Path('src/v4/landing-simple.js')
s = p.read_text()
old = '<button id="forgotPassword" class="mt-5 w-full text-center text-xs font-extrabold text-[#2235ae]">Lupa password?</button>'
new = '<button id="forgotPassword" data-action="open-reset-request" class="mt-5 w-full text-center text-xs font-extrabold text-[#2235ae]">Lupa Password? Ajukan Reset</button>'
if old not in s and new not in s:
    raise SystemExit('landing forgot-password anchor not found')
s = s.replace(old, new)
p.write_text(s)

# Private navigation + page title.
p = Path('src/v5/views.js')
s = p.read_text()
old = '    <button data-page="admin-users" class="simasi-nav">♙ Pengelolaan User</button>\n    <div class="my-4 border-t border-white/10"></div>'
new = '    <button data-page="admin-users" class="simasi-nav">♙ Pengelolaan User</button>\n    <button data-page="password-reset-requests" class="simasi-nav">🔐 Permintaan Reset Password</button>\n    <div class="my-4 border-t border-white/10"></div>'
if old in s:
    s = s.replace(old, new)
elif new not in s:
    raise SystemExit('admin nav anchor not found')

old = '    <button data-page="admin-import" class="simasi-nav">⇧ Import Data Mahasiswa</button>\n    <div class="my-4 border-t border-white/10"></div><button data-action="logout" class="simasi-nav text-rose-200">← Keluar</button>`'
new = '    <button data-page="admin-import" class="simasi-nav">⇧ Import Data Mahasiswa</button>\n    <button data-page="password-reset-requests" class="simasi-nav">🔐 Permintaan Reset Password</button>\n    <div class="my-4 border-t border-white/10"></div><button data-action="logout" class="simasi-nav text-rose-200">← Keluar</button>`'
if old in s:
    s = s.replace(old, new)
elif new not in s:
    raise SystemExit('staff nav anchor not found')

old = "    'admin-users':['Pengelolaan User','Administrator SIMASI'],"
new = "    'admin-users':['Pengelolaan User','Administrator SIMASI'],\n    'password-reset-requests':['Permintaan Reset Password',isAdmin()?'Administrator SIMASI':'Staf Akademik SIMASI'],"
if old in s:
    s = s.replace(old, new)
elif "'password-reset-requests'" not in s:
    raise SystemExit('title anchor not found')
p.write_text(s)

# Router imports and page rendering.
p = Path('src/app-v5.js')
s = p.read_text()
anchor = "import { privateShell, titleFor, adminDashboardHtml, lecturerDashboardHtml, registrationsHtml, announcementsHtml, importHtml, usersHtml, studentDashboardHtml, studentApplicationsHtml, seminarHtml } from './v5/views.js'\n"
addition = anchor + "import { passwordResetRequestsHtml, loadPasswordResetRequests } from './v5/password-reset.js'\n"
if "from './v5/password-reset.js'" not in s:
    if anchor not in s:
        raise SystemExit('app import anchor not found')
    s = s.replace(anchor, addition)

old = "  if(page==='admin-registrations'||page==='staff-dashboard'||page==='admin-import')return isStaff()"
new = "  if(page==='admin-registrations'||page==='staff-dashboard'||page==='admin-import'||page==='password-reset-requests')return isStaff()"
if old in s:
    s = s.replace(old, new)
elif new not in s:
    raise SystemExit('pageAllowed anchor not found')

old = "  if(state.page==='admin-users'){main.innerHTML=usersHtml();await loadUsers();return}"
new = "  if(state.page==='password-reset-requests'){main.innerHTML=passwordResetRequestsHtml();await loadPasswordResetRequests();return}\n  if(state.page==='admin-users'){main.innerHTML=usersHtml();await loadUsers();return}"
if old in s:
    s = s.replace(old, new)
elif "state.page==='password-reset-requests'" not in s:
    raise SystemExit('render reset page anchor not found')
p.write_text(s)

print('Password reset request UI patch applied')
