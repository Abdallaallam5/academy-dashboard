'use strict';
/* ====================== أدوات عامة ====================== */
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (Math.round((n || 0) * 100) / 100).toLocaleString('ar-EG') + ' ج';
const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmtDate(new Date());
const dayName = s => { const [y, m, d] = s.split('-').map(Number); return DAYS[new Date(y, m - 1, d).getDay()]; };
const monthLabel = m => { const [y, mo] = m.split('-'); return new Date(y, mo - 1, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }); };
const opts = (list, sel, all) => (all ? `<option value="">${all}</option>` : '') +
  list.map(x => `<option value="${x._id}" ${x._id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
const bal = n => `<b class="${n > 0 ? 'neg' : 'pos'}">${money(n)}</b>`;

const A = { token: localStorage.getItem('tk'), academy: localStorage.getItem('an') || 'الأكاديمية', students: [], teachers: [] };
const F = { month: todayStr().slice(0, 7), sStudent: '', sTeacher: '', pKind: '' };

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(A.token ? { Authorization: 'Bearer ' + A.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { logout(); throw new Error(data.error || 'سجّل دخول'); }
  if (!res.ok) { const e = new Error(data.error || 'حصل خطأ'); e.data = data; throw e; }
  return data;
}
function toast(msg, err) {
  const el = document.createElement('div');
  el.className = 't' + (err ? ' err' : ''); el.textContent = msg;
  $('#toast').appendChild(el); setTimeout(() => el.remove(), 3500);
}
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };
function modal(html, wide) {
  $('#modal').innerHTML = `<div class="ov" onmousedown="if(event.target===this)closeModal()"><div class="box ${wide ? 'wide' : ''}">${html}</div></div>`;
}
const closeModal = () => { $('#modal').innerHTML = ''; };
function formObj(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = v; });
  form.querySelectorAll('input[type=number]').forEach(i => { if (i.name) o[i.name] = i.value === '' ? undefined : Number(i.value); });
  form.querySelectorAll('input[type=checkbox][data-bool]').forEach(i => { o[i.name] = i.checked; });
  return o;
}
const loadPeople = async () => {
  [A.students, A.teachers] = await Promise.all([api('/students'), api('/teachers')]);
};
const active = list => list.filter(x => x.active);

/* ====================== الدخول / الهيكل ====================== */
function logout() { A.token = null; localStorage.removeItem('tk'); renderLogin(); }

function renderLogin() {
  $('#app').innerHTML = `<div class="login"><div class="card">
    <h1>🎓 ${esc(A.academy)}</h1><p>سجّل دخول لإدارة الأكاديمية</p>
    <form onsubmit="doLogin(event)" class="fg">
      <div><label>اسم المستخدم</label><input name="username" required autofocus></div>
      <div><label>كلمة السر</label><input name="password" type="password" required></div>
      <button class="btn">دخول</button>
    </form></div></div>`;
}
const doLogin = guard(async e => {
  e.preventDefault();
  const r = await api('/auth/login', { method: 'POST', body: formObj(e.target) });
  A.token = r.token; A.academy = r.academyName;
  localStorage.setItem('tk', r.token); localStorage.setItem('an', r.academyName);
  await start();
});

const NAV = [['dashboard', '🏠 الرئيسية'], ['sessions', '📅 الحصص'], ['students', '🧑‍🎓 الطلاب'], ['teachers', '👩‍🏫 المدرسين'], ['accounts', '💰 الحسابات'], ['payments', '🧾 المدفوعات']];
const PAGES = { dashboard: pDashboard, sessions: pSessions, students: () => pPeople('student'), teachers: () => pPeople('teacher'), accounts: pAccounts, payments: pPayments };

async function start() {
  await loadPeople();
  $('#app').innerHTML = `<div class="shell"><aside class="side"><h1>🎓 ${esc(A.academy)}</h1>
    ${NAV.map(([k, l]) => `<a href="#${k}" data-k="${k}">${l}</a>`).join('')}<div class="grow"></div>
    <button onclick="logout()">تسجيل خروج</button></aside><main class="content" id="page"></main></div>`;
  route();
}
const route = guard(async () => {
  if (!A.token) return;
  const k = (location.hash || '#dashboard').slice(1);
  const key = PAGES[k] ? k : 'dashboard';
  document.querySelectorAll('.side a').forEach(a => a.classList.toggle('on', a.dataset.k === key));
  $('#page').innerHTML = '<div class="empty">جاري التحميل…</div>';
  await PAGES[key]();
});
window.addEventListener('hashchange', route);
const refresh = () => route();

/* ====================== الرئيسية ====================== */
async function pDashboard() {
  const d = await api('/dashboard');
  const m = d.month;
  $('#page').innerHTML = `
  <div class="top"><h2>الرئيسية</h2><span class="note">${dayName(d.today)} ${d.today}</span></div>
  <div class="stats">
    <div class="stat"><small>إيراد الشهر (من الطلاب)</small><b>${money(m.income)}</b></div>
    <div class="stat"><small>مستحق المدرسين للشهر</small><b>${money(m.teacherCost)}</b></div>
    <div class="stat"><small>صافي الأكاديمية</small><b class="${m.net >= 0 ? 'pos' : 'neg'}">${money(m.net)}</b></div>
    <div class="stat"><small>الطلاب لسه عليهم</small><b class="${m.studentsOwe > 0 ? 'neg' : ''}">${money(m.studentsOwe)}</b></div>
    <div class="stat"><small>للمدرسين لسه</small><b>${money(m.owedToTeachers)}</b></div>
  </div>
  <div class="card"><h3>حصص النهارده (${d.sessions.length})</h3>${sessionsTable(d.sessions)}</div>`;
}

/* ====================== الحصص ====================== */
function sessionsTable(list) {
  if (!list.length) return '<div class="empty">مفيش حصص</div>';
  return `<div class="tbl"><table><thead><tr><th>التاريخ</th><th>اليوم</th><th>الساعة</th><th>الطالب</th><th>المدرس</th><th>المادة</th><th>سعر الطالب</th><th>أجر المدرس</th><th></th></tr></thead><tbody>${
    list.map(s => `<tr><td>${s.date}</td><td>${dayName(s.date)}</td><td>${s.startTime} <span class="note">(${s.durationMin}د)</span></td>
    <td>${esc(s.student?.name)}</td><td>${esc(s.teacher?.name)}</td><td>${esc(s.subject)}</td><td>${money(s.studentPrice)}</td><td>${money(s.teacherPay)}</td>
    <td><div class="acts"><button class="btn sm sec" onclick="sessionModal('${s._id}')">تعديل</button><button class="btn sm danger" onclick="delSession('${s._id}')">حذف</button></div></td></tr>`).join('')
  }</tbody></table></div>`;
}
let _sessions = [];
async function pSessions() {
  const q = new URLSearchParams({ month: F.month });
  if (F.sStudent) q.set('student', F.sStudent);
  if (F.sTeacher) q.set('teacher', F.sTeacher);
  _sessions = await api('/sessions?' + q);
  $('#page').innerHTML = `
  <div class="top"><h2>الحصص</h2>
    <button class="btn sec" onclick="sessionModal()">+ حصة واحدة</button>
    <button class="btn" onclick="bulkModal()">+ جدول شهري</button></div>
  <div class="card"><div class="filters">
    <div><label>الشهر</label><input type="month" value="${F.month}" onchange="F.month=this.value||F.month;refresh()"></div>
    <div><label>الطالب</label><select onchange="F.sStudent=this.value;refresh()">${opts(A.students, F.sStudent, 'الكل')}</select></div>
    <div><label>المدرس</label><select onchange="F.sTeacher=this.value;refresh()">${opts(A.teachers, F.sTeacher, 'الكل')}</select></div>
  </div>
  <p class="note">${_sessions.length} حصة — إجمالي من الطلاب: <b>${money(_sessions.reduce((a, x) => a + x.studentPrice, 0))}</b> · أجر المدرسين: <b>${money(_sessions.reduce((a, x) => a + x.teacherPay, 0))}</b></p>
  ${sessionsTable(_sessions)}</div>`;
}
const delSession = guard(async id => {
  if (!confirm('حذف الحصة؟')) return;
  await api('/sessions/' + id, { method: 'DELETE' }); toast('تم الحذف'); refresh();
});

function sessionFields(s = {}) {
  const st = s.student?._id || s.student, te = s.teacher?._id || s.teacher;
  return `
    <div><label>الطالب</label><select name="student" required onchange="autoPrice(this.form)">${opts(active(A.students).concat(A.students.filter(x => !x.active && x._id === st)), st)}</select></div>
    <div><label>المدرس</label><select name="teacher" required onchange="autoPrice(this.form,true)">${opts(active(A.teachers).concat(A.teachers.filter(x => !x.active && x._id === te)), te)}</select></div>
    <div><label>المادة</label><input name="subject" value="${esc(s.subject)}"></div>
    <div><label>الساعة</label><input type="time" name="startTime" required value="${s.startTime || '16:00'}"></div>
    <div><label>المدة (دقيقة)</label><input type="number" name="durationMin" min="5" max="600" value="${s.durationMin || 60}" required></div>
    <div><label>سعر الحصة على الطالب (ج)</label><input type="number" name="studentPrice" min="0" step="any" required value="${s.studentPrice ?? ''}"></div>
    <div><label>أجر المدرس عن الحصة (ج)</label><input type="number" name="teacherPay" min="0" step="any" required value="${s.teacherPay ?? ''}"></div>`;
}
function autoPrice(f, teacherChanged) {
  const s = A.students.find(x => x._id === f.student.value), t = A.teachers.find(x => x._id === f.teacher.value);
  if (s && !teacherChanged) f.studentPrice.value = s.pricePerSession;
  if (t && (teacherChanged || !f.teacherPay.value)) { f.teacherPay.value = t.ratePerSession; if (!f.subject.value) f.subject.value = t.subject; }
  if (s && !f.studentPrice.value) f.studentPrice.value = s.pricePerSession;
}
function sessionModal(id) {
  const s = id ? _sessions.find(x => x._id === id) || {} : {};
  if (!active(A.students).length || !active(A.teachers).length) return toast('ضيف طالب ومدرس الأول', true);
  modal(`<h3>${id ? 'تعديل حصة' : 'حصة جديدة'}</h3>
  <form onsubmit="saveSession(event,'${id || ''}')" class="fg">
    <div><label>التاريخ</label><input type="date" name="date" required value="${s.date || todayStr()}"></div>
    ${sessionFields(s)}
    <div class="full"><label>ملاحظات</label><input name="notes" value="${esc(s.notes)}"></div>
    <div class="full foot"><button class="btn">حفظ</button><button type="button" class="btn sec" onclick="closeModal()">إلغاء</button></div>
  </form>`);
  if (!id) autoPrice($('#modal form'));
}
const saveSession = guard(async (e, id) => {
  e.preventDefault();
  await api('/sessions' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body: formObj(e.target) });
  closeModal(); toast('تم الحفظ'); refresh();
});

function bulkModal() {
  if (!active(A.students).length || !active(A.teachers).length) return toast('ضيف طالب ومدرس الأول', true);
  modal(`<h3>إنشاء جدول شهري</h3>
  <p class="note">بيعمل حصة في كل يوم من الأيام المختارة طول الشهر، وبيتخطى أي يوم فيه تعارض مواعيد للمدرس أو الطالب.</p>
  <form onsubmit="saveBulk(event)" class="fg">
    ${sessionFields()}
    <div><label>الشهر</label><input type="month" name="month" required value="${F.month}"></div>
    <div><label>ابدأ من يوم (اختياري)</label><input type="date" name="fromDate"></div>
    <div class="full"><label>أيام الحصص</label><div class="days">${DAYS.map((d, i) => `<label><input type="checkbox" name="d" value="${i}">${d}</label>`).join('')}</div></div>
    <div class="full foot"><button class="btn">إنشاء الجدول</button><button type="button" class="btn sec" onclick="closeModal()">إلغاء</button></div>
  </form>`);
  autoPrice($('#modal form'));
}
const saveBulk = guard(async e => {
  e.preventDefault();
  const o = formObj(e.target);
  o.days = [...e.target.querySelectorAll('input[name=d]:checked')].map(i => +i.value);
  delete o.d;
  if (!o.fromDate) delete o.fromDate;
  const r = await api('/sessions/bulk', { method: 'POST', body: o });
  const month = o.month;
  F.month = month;
  modal(`<h3>✅ تم إنشاء ${r.created} حصة</h3>
    ${r.skipped.length ? `<div class="card" style="background:var(--warn-soft)"><b>اتخطينا ${r.skipped.length} يوم بسبب تعارض:</b><br>${r.skipped.map(s => `${s.date} (${dayName(s.date)}) — ${s.reason}`).join('<br>')}</div>` : ''}
    <p>تبعت الجدول PDF على الواتساب؟</p>
    <div class="foot">
      <button class="btn wa" onclick="openStatement('student','${o.student}','${month}')">للطالب: ${esc(A.students.find(x => x._id === o.student)?.name)}</button>
      <button class="btn wa" onclick="openStatement('teacher','${o.teacher}','${month}')">للمدرس: ${esc(A.teachers.find(x => x._id === o.teacher)?.name)}</button>
      <button class="btn sec" onclick="closeModal();refresh()">مش دلوقتي</button></div>`);
  if (location.hash !== '#sessions') location.hash = '#sessions'; else refresh();
});

/* ====================== الطلاب والمدرسين ====================== */
async function pPeople(kind) {
  const isS = kind === 'student';
  await loadPeople();
  const list = isS ? A.students : A.teachers;
  $('#page').innerHTML = `
  <div class="top"><h2>${isS ? 'الطلاب' : 'المدرسين'} (${list.length})</h2><button class="btn" onclick="personModal('${kind}')">+ ${isS ? 'طالب جديد' : 'مدرس جديد'}</button></div>
  <div class="card">${list.length ? `<div class="tbl"><table><thead><tr><th>الاسم</th><th>واتساب</th><th>${isS ? 'الصف' : 'المادة'}</th><th>${isS ? 'سعر الحصة' : 'أجر الحصة'}</th><th>الحالة</th><th></th></tr></thead><tbody>${
    list.map(p => `<tr class="${p.active ? '' : 'inactive'}"><td><b>${esc(p.name)}</b></td><td>${esc(p.phone)}</td><td>${esc(isS ? p.grade : p.subject)}</td><td>${money(isS ? p.pricePerSession : p.ratePerSession)}</td><td>${p.active ? 'نشط' : 'متوقف'}</td>
    <td><div class="acts"><button class="btn sm" onclick="openStatement('${kind}','${p._id}','${F.month}')">الجدول والحساب</button>
    <button class="btn sm sec" onclick="personModal('${kind}','${p._id}')">تعديل</button>
    <button class="btn sm danger" onclick="delPerson('${kind}','${p._id}')">حذف</button></div></td></tr>`).join('')
  }</tbody></table></div>` : '<div class="empty">لسه مفيش بيانات — ضيف أول واحد</div>'}</div>`;
}
function personModal(kind, id) {
  const isS = kind === 'student';
  const p = id ? (isS ? A.students : A.teachers).find(x => x._id === id) : { active: true };
  modal(`<h3>${id ? 'تعديل' : 'إضافة'} ${isS ? 'طالب' : 'مدرس'}</h3>
  <form onsubmit="savePerson(event,'${kind}','${id || ''}')" class="fg">
    <div><label>الاسم</label><input name="name" required value="${esc(p.name)}"></div>
    <div><label>رقم واتساب</label><input name="phone" inputmode="tel" placeholder="01xxxxxxxxx" value="${esc(p.phone)}"></div>
    <div><label>${isS ? 'الصف / المرحلة' : 'المادة'}</label><input name="${isS ? 'grade' : 'subject'}" value="${esc(isS ? p.grade : p.subject)}"></div>
    <div><label>${isS ? 'سعر الحصة الافتراضي (ج)' : 'أجر الحصة الافتراضي (ج)'}</label><input type="number" min="0" step="any" name="${isS ? 'pricePerSession' : 'ratePerSession'}" value="${(isS ? p.pricePerSession : p.ratePerSession) ?? 0}"></div>
    <div class="full"><label>ملاحظات</label><input name="notes" value="${esc(p.notes)}"></div>
    <div class="full"><label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" data-bool name="active" style="width:auto" ${p.active ? 'checked' : ''}> نشط</label></div>
    <div class="full foot"><button class="btn">حفظ</button><button type="button" class="btn sec" onclick="closeModal()">إلغاء</button></div>
  </form>`);
}
const savePerson = guard(async (e, kind, id) => {
  e.preventDefault();
  await api(`/${kind}s` + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body: formObj(e.target) });
  closeModal(); toast('تم الحفظ'); refresh();
});
const delPerson = guard(async (kind, id) => {
  if (!confirm('متأكد من الحذف؟')) return;
  try { await api(`/${kind}s/${id}`, { method: 'DELETE' }); }
  catch (e) {
    if (e.data?.details?.sessions && confirm(e.message + '\nتحذفه هو وكل حصصه ومدفوعاته نهائيًا؟')) await api(`/${kind}s/${id}?force=1`, { method: 'DELETE' });
    else throw e;
  }
  toast('تم الحذف'); refresh();
});

/* ====================== الحسابات ====================== */
async function pAccounts() {
  const d = await api('/accounts?month=' + F.month);
  const s = d.summary;
  const tbl = (rows, kind) => rows.length ? `<div class="tbl"><table><thead><tr><th>الاسم</th><th>عدد الحصص</th><th>مستحق الشهر</th><th>مدفوع الشهر</th><th>${kind === 'student' ? 'المتبقي عليه' : 'المتبقي له'} (إجمالي)</th><th></th></tr></thead><tbody>${
    rows.map(r => `<tr class="${r.active ? '' : 'inactive'}"><td><b>${esc(r.name)}</b></td><td>${r.sessions}</td><td>${money(r.monthDue)}</td><td>${money(r.monthPaid)}</td><td>${bal(r.balance)}</td>
    <td><div class="acts"><button class="btn sm" onclick="openStatement('${kind}','${r._id}','${d.month}')">كشف / PDF</button>
    <button class="btn sm sec" onclick="paymentModal('${kind}','${r._id}')">${kind === 'student' ? 'استلام دفعة' : 'دفع للمدرس'}</button></div></td></tr>`).join('')
  }</tbody></table></div>` : '<div class="empty">مفيش بيانات</div>';
  $('#page').innerHTML = `
  <div class="top"><h2>الحسابات</h2><div><input type="month" value="${d.month}" onchange="F.month=this.value||F.month;refresh()"></div></div>
  <div class="stats">
    <div class="stat"><small>إيراد الطلاب للشهر</small><b>${money(s.income)}</b></div>
    <div class="stat"><small>مستحق المدرسين للشهر</small><b>${money(s.teacherCost)}</b></div>
    <div class="stat"><small>صافي الأكاديمية</small><b class="${s.net >= 0 ? 'pos' : 'neg'}">${money(s.net)}</b></div>
    <div class="stat"><small>اتحصّل من الطلاب هذا الشهر</small><b>${money(s.collected)}</b></div>
    <div class="stat"><small>اتدفع للمدرسين هذا الشهر</small><b>${money(s.paidOut)}</b></div>
  </div>
  <div class="card"><h3>حساب الطلاب</h3>${tbl(d.students, 'student')}</div>
  <div class="card"><h3>حساب المدرسين</h3>${tbl(d.teachers, 'teacher')}</div>`;
}

/* ====================== المدفوعات ====================== */
async function pPayments() {
  const q = new URLSearchParams({ month: F.month }); if (F.pKind) q.set('kind', F.pKind);
  const list = await api('/payments?' + q);
  $('#page').innerHTML = `
  <div class="top"><h2>المدفوعات</h2><button class="btn" onclick="paymentModal()">+ تسجيل دفعة</button></div>
  <div class="card"><div class="filters">
    <div><label>الشهر</label><input type="month" value="${F.month}" onchange="F.month=this.value||F.month;refresh()"></div>
    <div><label>النوع</label><select onchange="F.pKind=this.value;refresh()"><option value="">الكل</option><option value="student" ${F.pKind === 'student' ? 'selected' : ''}>من طلاب</option><option value="teacher" ${F.pKind === 'teacher' ? 'selected' : ''}>لمدرسين</option></select></div></div>
  ${list.length ? `<div class="tbl"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الاسم</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead><tbody>${
    list.map(p => `<tr><td>${p.date}</td><td>${p.kind === 'student' ? '<span class="badge b-done">من طالب</span>' : '<span class="badge b-absent">لمدرس</span>'}</td><td>${esc(p.personName)}</td><td><b>${money(p.amount)}</b></td><td>${esc(p.note)}</td>
    <td><button class="btn sm danger" onclick="delPayment('${p._id}')">حذف</button></td></tr>`).join('')
  }</tbody></table></div>` : '<div class="empty">مفيش مدفوعات في الشهر ده</div>'}</div>`;
}
function paymentModal(kind, person) {
  kind = kind || 'student';
  modal(`<h3>تسجيل دفعة</h3>
  <form onsubmit="savePayment(event)" class="fg">
    <div><label>النوع</label><select name="kind" onchange="this.form.person.innerHTML=payOpts(this.value)" ${person ? 'disabled' : ''}><option value="student" ${kind === 'student' ? 'selected' : ''}>استلام من طالب</option><option value="teacher" ${kind === 'teacher' ? 'selected' : ''}>دفع لمدرس</option></select></div>
    <div><label>الاسم</label><select name="person" required ${person ? 'disabled' : ''}>${payOpts(kind, person)}</select></div>
    <div><label>المبلغ (ج)</label><input type="number" name="amount" min="0.01" step="any" required autofocus></div>
    <div><label>التاريخ</label><input type="date" name="date" value="${todayStr()}" required></div>
    <div class="full"><label>ملاحظة</label><input name="note"></div>
    <div class="full foot"><button class="btn">حفظ</button><button type="button" class="btn sec" onclick="closeModal()">إلغاء</button></div>
  </form>`);
  $('#modal form').dataset.kind = kind; $('#modal form').dataset.person = person || '';
}
const payOpts = (kind, sel) => opts(kind === 'student' ? A.students : A.teachers, sel);
const savePayment = guard(async e => {
  e.preventDefault();
  const f = e.target, o = formObj(f);
  if (f.dataset.person) { o.kind = f.dataset.kind; o.person = f.dataset.person; }
  await api('/payments', { method: 'POST', body: o });
  closeModal(); toast('تم تسجيل الدفعة'); refresh();
});
const delPayment = guard(async id => {
  if (!confirm('حذف الدفعة؟')) return;
  await api('/payments/' + id, { method: 'DELETE' }); toast('تم الحذف'); refresh();
});

/* ====================== كشف الحساب / الجدول PDF / واتساب ====================== */
let _stmt = null;
const openStatement = guard(async (kind, id, month) => {
  _stmt = await api(`/statements/${kind}/${id}?month=${month}`);
  modal(`<div class="filters"><div><label>الشهر</label><input type="month" value="${month}" onchange="openStatement('${kind}','${id}',this.value||'${month}')"></div></div>
    <div class="sheet">${statementHTML(_stmt)}</div>
    <div class="foot">
      <button class="btn wa" id="waBtn" onclick="sendWhatsApp()">إرسال على واتساب (PDF)</button>
      ${_stmt.person.phone ? `<a class="btn sec" style="text-decoration:none" target="_blank" rel="noopener" href="${waUrl()}">فتح المحادثة فقط</a>` : ''}
      <button class="btn" onclick="downloadPdf()">تحميل PDF</button>
      <button class="btn sec" onclick="closeModal()">إغلاق</button></div>
    <p class="note">${_stmt.person.phone ? '' : '⚠️ مفيش رقم واتساب مسجل — ضيفه من صفحة التعديل. '}واتساب مبيسمحش بإرسال ملف تلقائيًا: على الموبايل بتختار واتساب من قايمة المشاركة، وعلى الكمبيوتر الملف بيتحمّل وتفتح المحادثة وترفقه.</p>`, true);
  getPdf();
});

function statementHTML(d) {
  const isS = d.kind === 'student';
  const th = 'style="border:1px solid #d5dae6;padding:8px;background:#eef2fb"', td = 'style="border:1px solid #d5dae6;padding:7px;text-align:center"';
  const rows = d.sessions;
  const t = d.totals;
  return `<div dir="rtl" style="font-family:Cairo,Arial,sans-serif;color:#1b2236;background:#fff;padding:28px;width:100%;min-width:640px">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #2f6fed;padding-bottom:10px">
      <div><div style="font-size:13px;color:#6a7389">${esc(A.academy)}</div><div style="font-size:24px;font-weight:700;color:#2f6fed">جدول الحصص وكشف الحساب</div></div>
      <div style="text-align:left;font-size:14px">${monthLabel(d.month)}</div></div>
    <p style="font-size:17px;margin:14px 0">${isS ? 'الطالب' : 'المدرس'}: <b>${esc(d.person.name)}</b></p>
    ${rows.length ? `<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>
      <th ${th}>#</th><th ${th}>التاريخ</th><th ${th}>اليوم</th><th ${th}>الساعة</th><th ${th}>${isS ? 'المدرس' : 'الطالب'}</th><th ${th}>المادة</th><th ${th}>${isS ? 'السعر' : 'الأجر'}</th></tr></thead><tbody>${
      rows.map((s, i) => `<tr><td ${td}>${i + 1}</td><td ${td}>${s.date}</td><td ${td}>${dayName(s.date)}</td><td ${td}>${s.startTime}</td><td ${td}>${esc(s.other)}</td><td ${td}>${esc(s.subject)}</td><td ${td}>${money(s.amount)}</td></tr>`).join('')
    }</tbody></table>` : '<p style="color:#6a7389">مفيش حصص في الشهر ده</p>'}
    <table style="width:100%;margin-top:16px;border-collapse:collapse;font-size:15px">
      <tr><td ${td}>عدد الحصص</td><td ${td}><b>${t.sessions}</b></td><td ${td}>إجمالي الشهر</td><td ${td}><b>${money(t.due)}</b></td></tr>
      <tr><td ${td} colspan="2">&nbsp;</td><td ${td}>${isS ? 'المدفوع هذا الشهر' : 'اللي اتدفع هذا الشهر'}</td><td ${td}><b>${money(t.paid)}</b></td></tr>
      <tr><td ${td} colspan="2" style="border:1px solid #d5dae6;padding:9px;text-align:center;background:#eef2fb"><b>${isS ? 'المتبقي على الطالب (إجمالي)' : 'المتبقي للمدرس (إجمالي)'}</b></td><td ${td} colspan="2" style="border:1px solid #d5dae6;padding:9px;text-align:center;background:#eef2fb"><b style="font-size:18px;color:${t.balance > 0 ? '#d03636' : '#12895a'}">${money(t.balance)}</b></td></tr>
    </table>
    ${d.payments.length ? `<p style="margin:14px 0 6px;font-weight:700">الدفعات:</p><div style="font-size:14px">${d.payments.map(p => `${p.date} — ${money(p.amount)} ${esc(p.note)}`).join('<br>')}</div>` : ''}
  </div>`;
}

async function makePdf(stmt) {
  const host = document.createElement('div');
  host.innerHTML = statementHTML(stmt);
  $('#pdfhost').appendChild(host);
  const name = `جدول-${stmt.person.name}-${stmt.month}.pdf`;
  try {
    await document.fonts.ready;
    const blob = await html2pdf().from(host.firstElementChild).set({
      margin: 0, filename: name, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2 },
      jsPDF: { unit: 'pt', format: 'a4' }, pagebreak: { mode: ['avoid-all', 'css'] },
    }).outputPdf('blob');
    return { blob, name };
  } finally { host.remove(); }
}
// الـ PDF بيتجهز في الخلفية أول ما الكشف يتفتح، عشان زرار الواتساب يشتغل فورًا
let _pdfFor = null, _pdfP = null;
function getPdf() {
  if (_pdfFor !== _stmt) { _pdfFor = _stmt; _pdfP = makePdf(_stmt); _pdfP.catch(() => { _pdfFor = null; }); }
  return _pdfP;
}
const saveBlob = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); };
const downloadPdf = guard(async () => { const { blob, name } = await getPdf(); saveBlob(blob, name); });

function waPhone(raw) {
  let n = String(raw || '').replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2); else if (n.startsWith('0')) n = '20' + n.slice(1);
  return n;
}
const waText = () => `أهلاً ${_stmt.person.name}، ده جدول الحصص لشهر ${monthLabel(_stmt.month)} من ${A.academy}.`;
const waUrl = () => `https://wa.me/${waPhone(_stmt.person.phone)}?text=${encodeURIComponent(waText())}`;
const canShareFiles = () => {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] })); } catch { return false; }
};

const sendWhatsApp = guard(async () => {
  const p = _stmt.person;
  if (!p.phone) throw new Error('مفيش رقم واتساب مسجل لـ ' + p.name);
  const btn = $('#waBtn'); btn.disabled = true;
  const share = canShareFiles();
  // لازم نفتح نافذة واتساب فورًا داخل الضغطة نفسها وإلا المتصفح بيحجبها (popup blocker)
  const win = share ? null : window.open('about:blank', '_blank');
  try {
    const { blob, name } = await getPdf();
    if (share) {
      const file = new File([blob], name, { type: 'application/pdf' });
      try { await navigator.share({ files: [file], text: waText() }); } catch (e) { if (e.name !== 'AbortError') throw e; }
      return;
    }
    saveBlob(blob, name);
    if (win) { win.location.href = waUrl(); toast('اتحمّل الـ PDF وفتحنا المحادثة — ارفق الملف واضغط إرسال'); }
    else toast('اتحمّل الـ PDF. المتصفح حجب فتح واتساب — اضغط "فتح المحادثة"', true);
  } catch (e) { if (win) win.close(); throw e; }
  finally { btn.disabled = false; }
});

/* ====================== تشغيل ====================== */
if (A.token) start().catch(() => logout()); else renderLogin();
