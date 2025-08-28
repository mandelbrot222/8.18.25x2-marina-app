/* Employee Schedule page logic
 * - Weekly calendar with time-off overlays
 * - Legend of employees (filter/highlight)
 * - Strict time-off rules:
 *    PTO: 14-day lead time, summer cap (3 days Jun 1–Sep 30), must have PTO hours
 *    SICK (WA PSL): allow only up to accrued sick hours; if >3 days, flag verification notice
 * - Admin panel: year totals (requested/approved/taken) by employee
 * - NEW: optional roster sync from data/employees.json (writes to localStorage)
 */

// ===== Setup & Utilities =====
ensureLoggedIn();

const HOURS_PER_DAY = 8;
const POLICY = {
  summer: { startMonth: 6, startDay: 1, endMonth: 9, endDay: 30, ptoCapDays: 3 },
  leadTimeDaysForPTO: 14,
  hoursPerFullDay: HOURS_PER_DAY
};
const TIME_OFF_KEY = 'timeOffRequests';
const EMPLOYEES_KEY = 'employees';

// Admin detection
function isAdmin() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('admin') === '1') return true;
  } catch {}
  return localStorage.getItem('currentUserIsAdmin') === 'true';
}

// current user (optional, used to default selection)
function getCurrentUserId() {
  return localStorage.getItem('currentUserId') || null;
}

function ymd(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function dayDiffInclusive(startDate, endDate) {
  const s = new Date(ymd(startDate));
  const e = new Date(ymd(endDate));
  return Math.floor((e - s) / 86400000) + 1;
}
function hoursBetween(start, end) {
  return Math.max(0, (new Date(end) - new Date(start)) / 3600000);
}
function inSummerWindow(dateObj) {
  const y = dateObj.getFullYear();
  const start = new Date(y, POLICY.summer.startMonth - 1, POLICY.summer.startDay);
  const end = new Date(y, POLICY.summer.endMonth - 1, POLICY.summer.endDay, 23, 59, 59, 999);
  return dateObj >= start && dateObj <= end;
}

// Storage wrappers (rely on common.js for getItems/saveItem/deleteItem if present)
function getList(key) {
  try {
    if (typeof getItems === 'function') return getItems(key);
  } catch {}
  return JSON.parse(localStorage.getItem(key) || '[]');
}
function setList(key, array) {
  localStorage.setItem(key, JSON.stringify(array || []));
}

// ===== Data Load (now mutable due to roster sync) =====
let EMPLOYEES = getList(EMPLOYEES_KEY); // was const; now let so we can refresh after fetch
const TIME_OFF = getList(TIME_OFF_KEY);  // not mutated here

// ===== Optional roster sync from data/employees.json =====
async function syncEmployeesFromFile() {
  try {
    const res = await fetch('data/employees.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    if (Array.isArray(data)) {
      localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(data));
      EMPLOYEES = getList(EMPLOYEES_KEY); // refresh in-memory
    }
  } catch (e) {
    // Offline or file missing: keep existing localStorage values
    console.warn('Roster sync skipped:', e.message || e);
  }
}

// ===== Calendar =====
let empCalendar = null;

function toCalendarEvents() {
  // Convert TIME_OFF records into FullCalendar events
  return getList(TIME_OFF_KEY).map(req => {
    const colorByType = { PTO: '#007F7E', SICK: '#E67E22' };
    const title = `${typeLabel(req.kind)} - ${employeeName(req.employeeId)}`;
    return {
      title,
      start: req.startISO,
      end: req.endISO,
      backgroundColor: colorByType[req.kind] || '#7A7A7A',
      borderColor: colorByType[req.kind] || '#7A7A7A',
      opacity: req.status === 'denied' ? 0.4 : 1,
      extendedProps: { req }
    };
  });
}

function typeLabel(k) {
  if (k === 'PTO') return 'PTO';
  if (k === 'SICK') return 'Sick';
  return k;
}

function employeeName(id) {
  const e = EMPLOYEES.find(x => String(x.id) === String(id));
  return e ? e.name : `Emp ${id}`;
}

function initCalendar() {
  const el = document.getElementById('employee-calendar');
  if (!el) return;
  empCalendar = new FullCalendar.Calendar(el, {
    initialView: 'timeGridWeek',
    height: 'auto',
    dayHeaderContent: (arg) => {
      const dow = arg.date.toLocaleDateString([], { weekday: 'short' });
      const m = String(arg.date.getMonth() + 1);
      const d = String(arg.date.getDate());
      return { html: `<div class="nm-dow">${dow}</div><div class="nm-date">${m}/${d}</div>` };
    },
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    slotDuration: '00:30:00',
    slotMinTime: '07:00:00',
    slotMaxTime: '16:00:00',
    allDaySlot: false,
    events: toCalendarEvents(),
    eventClick: (info) => {
      const { req } = info.event.extendedProps;
      alert(`${typeLabel(req.kind)} for ${employeeName(req.employeeId)}\n`
        + `${new Date(req.startISO).toLocaleString()} → ${new Date(req.endISO).toLocaleString()}\n`
        + `Status: ${req.status}${req.verificationNeeded ? ' (verification may be required)' : ''}`);
    }
  });
  empCalendar.render();
}

function refreshCalendar() {
  if (!empCalendar) return;
  empCalendar.removeAllEvents();
  toCalendarEvents().forEach(ev => empCalendar.addEvent(ev));
}

// ===== Legend =====
function renderLegend() {
  const listEl = document.getElementById('emp-legend-list');
  listEl.innerHTML = '';
  if (!EMPLOYEES.length) {
    listEl.innerHTML = '<div>No employees found.</div>';
    return;
  }
  EMPLOYEES.forEach(emp => {
    const row = document.createElement('div');
    row.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-color';
    swatch.style.backgroundColor = emp.color || '#4577D5';
    const label = document.createElement('span');
    label.innerHTML = `<strong>${emp.name}</strong> &nbsp; <span style="opacity:.8">${emp.position || ''}</span>`;
    row.appendChild(swatch);
    row.appendChild(label);
    listEl.appendChild(row);
  });
}

// ===== Request Modal =====
const modal = {
  el: document.getElementById('request-modal'),
  form: null
};

function openRequestModal() {
  populateRequestEmployees();
  // defaults: current week, today
  const today = new Date();
  document.getElementById('req-start-date').value = ymd(today);
  document.getElementById('req-end-date').value = ymd(today);
  document.getElementById('req-start-time').value = '08:00';
  document.getElementById('req-end-time').value = '16:00';
  document.getElementById('req-fullday').value = 'yes';
  toggleTimeInputs();
  modal.el.style.display = 'flex';
}
function closeRequestModal() { modal.el.style.display = 'none'; }

function populateRequestEmployees() {
  const sel = document.getElementById('req-employee');
  sel.innerHTML = '';
  const curId = getCurrentUserId();
  EMPLOYEES.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.name} (${e.position || ''})`;
    sel.appendChild(opt);
  });
  if (curId && EMPLOYEES.some(e => String(e.id) === String(curId))) {
    sel.value = curId;
  }
  sel.disabled = false;
}

function toggleTimeInputs() {
  const full = document.getElementById('req-fullday').value === 'yes';
  document.getElementById('req-start-time').disabled = full;
  document.getElementById('req-end-time').disabled = full;
}

// ===== Rule Checks =====
function strictCheckAndBuildRecord(form) {
  const kind = form.type;
  const employeeId = form.employeeId;
  const full = form.fullDay;
  const startISO = new Date(`${form.startDate}T${full ? '08:00' : form.startTime}`).toISOString();
  const endISO = new Date(`${form.endDate}T${full ? '16:00' : form.endTime}`).toISOString();
  if (new Date(endISO) <= new Date(startISO)) {
    return { ok: false, reasons: ['End must be after start'] };
  }

  const emp = EMPLOYEES.find(e => String(e.id) === String(employeeId));
  if (!emp) return { ok: false, reasons: ['Employee not found'] };

  // Compute hours requested
  let hours;
  if (full) {
    const days = dayDiffInclusive(form.startDate, form.endDate);
    hours = days * POLICY.hoursPerFullDay;
  } else {
    hours = Math.max(0.5, hoursBetween(startISO, endISO)); // minimum 0.5h chunk
  }

  const startDateObj = new Date(form.startDate);
  const endDateObj = new Date(form.endDate);

  // PTO rules (strict)
  if (kind === 'PTO') {
    // Lead time
    const today = new Date();
    const msLead = (POLICY.leadTimeDaysForPTO) * 86400000;
    if (new Date(startDateObj) - today < msLead) {
      return { ok: false, reasons: [`PTO requires at least ${POLICY.leadTimeDaysForPTO} days of notice`] };
    }
    // Summer cap (by days) within Jun 1–Sep 30
    const anyInSummer = inSummerWindow(startDateObj) || inSummerWindow(endDateObj);
    if (anyInSummer) {
      const usedDays = countEmployeeSummerPTODays(employeeId, startDateObj.getFullYear());
      const requestedDays = full ? dayDiffInclusive(form.startDate, form.endDate) : Math.ceil(hours / POLICY.hoursPerFullDay);
      if (usedDays + requestedDays > POLICY.summer.ptoCapDays) {
        return { ok: false, reasons: [`Summer PTO cap of ${POLICY.summer.ptoCapDays} day(s) exceeded`] };
      }
    }
    // PTO balance (use emp.ptoHours; if missing, treat as 0 for strictness)
    const ptoAvail = Number(emp.ptoHours || 0);
    if (hours > ptoAvail) {
      return { ok: false, reasons: ['Insufficient PTO balance'] };
    }
  }

  // SICK (WA PSL) rules (strict & compliant)
  if (kind === 'SICK') {
    const pslAvail = Number(emp.pslHours || 0);
    if (hours > pslAvail) {
      return { ok: false, reasons: ['Insufficient WA Paid Sick Leave balance'] };
    }
  }

  let status = 'approved';
  let verificationNeeded = false;

  // Sick > 3 days: verification may be requested (policy notice)
  if (kind === 'SICK') {
    const daysRequested = full
      ? dayDiffInclusive(form.startDate, form.endDate)
      : Math.ceil(hours / POLICY.hoursPerFullDay);
    if (daysRequested > 3) verificationNeeded = true;
  }

  // Build record
  const rec = {
    id: cryptoRandomId(),
    employeeId,
    kind,
    startISO,
    endISO,
    hours,
    notes: form.notes || '',
    status,
    createdAtISO: new Date().toISOString(),
    verificationNeeded
  };
  return { ok: true, record: rec };
}

function cryptoRandomId() {
  try { return crypto.randomUUID(); } catch { return 'id-' + Math.random().toString(36).slice(2); }
}

function countEmployeeSummerPTODays(employeeId, year) {
  const list = getList(TIME_OFF_KEY);
  let total = 0;
  list.forEach(req => {
    if (String(req.employeeId) !== String(employeeId)) return;
    if (req.kind !== 'PTO') return;
    const s = new Date(req.startISO), e = new Date(req.endISO);
    if (s.getFullYear() !== year && e.getFullYear() !== year) return;
    // Count days within summer window
    for (let d = new Date(s); d <= e; d = new Date(d.getTime() + 86400000)) {
      if (inSummerWindow(d)) total += 1;
    }
  });
  return total;
}

// ===== Admin Panel =====
function renderAdminPanel() {
  const panel = document.getElementById('admin-panel');
  if (!isAdmin()) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  const yearSel = document.getElementById('adminYear');
  const thisYear = new Date().getFullYear();
  yearSel.innerHTML = '';
  for (let y = thisYear - 2; y <= thisYear + 1; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === thisYear) opt.selected = true;
    yearSel.appendChild(opt);
  }
  yearSel.onchange = () => drawAdminTotals(Number(yearSel.value));
  drawAdminTotals(thisYear);

  document.getElementById('btn-export-admin').onclick = () => {
    const y = Number(yearSel.value);
    const csv = buildAdminCSV(y);
    downloadText(`employee_timeoff_totals_${y}.csv`, csv);
  };
}

function drawAdminTotals(year) {
  const list = getList(TIME_OFF_KEY).filter(r => {
    const sY = new Date(r.startISO).getFullYear();
    const eY = new Date(r.endISO).getFullYear();
    return sY === year || eY === year;
  });
  const byEmp = new Map();
  EMPLOYEES.forEach(e => byEmp.set(String(e.id), {
    name: e.name, position: e.position || '',
    ptoReqH: 0, ptoAppH: 0, ptoTakenH: 0,
    sickReqH: 0, sickAppH: 0, sickTakenH: 0
  }));

  list.forEach(r => {
    const k = String(r.employeeId);
    if (!byEmp.has(k)) return;
    const bucket = byEmp.get(k);
    const hrs = Number(r.hours || 0);
    const isPast = new Date(r.endISO) < new Date(); // taken if event ended already
    const kindKey = r.kind === 'PTO' ? 'pto' : r.kind === 'SICK' ? 'sick' : null;
    if (!kindKey) return;
    bucket[`${kindKey}ReqH`] += hrs;
    if (r.status === 'approved') bucket[`${kindKey}AppH`] += hrs;
    if (isPast && r.status === 'approved') bucket[`${kindKey}TakenH`] += hrs;
  });

  // Build table
  const el = document.getElementById('adminTotals');
  const rows = [];
  rows.push(`<div style="display:grid;grid-template-columns:1.2fr .8fr repeat(3,1fr) / 1fr;gap:6px;font-weight:600;">
    <div>Employee</div><div>Position</div>
    <div>Requested (hrs)</div><div>Approved (hrs)</div><div>Taken (hrs)</div>
  </div>`);
  byEmp.forEach(v => {
    const req = v.ptoReqH + v.sickReqH;
    const app = v.ptoAppH + v.sickAppH;
    const tak = v.ptoTakenH + v.sickTakenH;
    rows.push(`<div style="display:grid;grid-template-columns:1.2fr .8fr repeat(3,1fr);gap:6px;">
      <div>${escapeHtml(v.name)}</div><div>${escapeHtml(v.position)}</div>
      <div>${req.toFixed(1)}</div><div>${app.toFixed(1)}</div><div>${tak.toFixed(1)}</div>
    </div>`);
  });
  el.innerHTML = rows.join('');
}

function buildAdminCSV(year) {
  const lines = [];
  lines.push(['Year', 'Employee', 'Position', 'Requested (hrs)', 'Approved (hrs)', 'Taken (hrs)'].join(','));
  const el = document.createElement('div');
  el.innerHTML = document.getElementById('adminTotals').innerHTML;
  const rows = Array.from(el.querySelectorAll('div')).slice(1); // skip header
  rows.forEach(row => {
    const cols = row.querySelectorAll('div');
    if (cols.length < 5) return;
    lines.push([year, cols[0].textContent, cols[1].textContent, cols[2].textContent, cols[3].textContent, cols[4].textContent].map(csvEscape).join(','));
  });
  return lines.join('\n');
}

function downloadText(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'text/plain'}));
  a.download = filename;
  a.click();
}

function csvEscape(s) {
  s = String(s || '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;","\">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

// ===== Request Handling =====
function handleRequestSubmit(e) {
  e.preventDefault();
  const kind = document.getElementById('req-type').value;
  const employeeId = document.getElementById('req-employee').value;
  const fullDay = document.getElementById('req-fullday').value === 'yes';
  const startDate = document.getElementById('req-start-date').value;
  const endDate = document.getElementById('req-end-date').value;
  const startTime = document.getElementById('req-start-time').value;
  const endTime = document.getElementById('req-end-time').value;
  const notes = document.getElementById('req-notes').value.trim();

  const check = strictCheckAndBuildRecord({
    type: kind, employeeId,
    fullDay, startDate, endDate, startTime, endTime, notes
  });

  if (!check.ok) {
    alert('Not approved under current policy:\n- ' + check.reasons.join('\n- ') + '\n\nIf you still need this time off, please speak with your manager.');
    // Record a denied request
    const deniedRecord = {
      id: cryptoRandomId(),
      employeeId, kind,
      startISO: new Date(`${startDate}T${fullDay?'08:00':startTime}`).toISOString(),
      endISO: new Date(`${endDate}T${fullDay?'16:00':endTime}`).toISOString(),
      hours: fullDay ? dayDiffInclusive(startDate, endDate) * POLICY.hoursPerFullDay : Math.max(0.5, hoursBetween(`${startDate}T${startTime}`, `${endDate}T${endTime}`)),
      notes, status: 'denied', createdAtISO: new Date().toISOString()
    };
    const list = getList(TIME_OFF_KEY);
    list.push(deniedRecord);
    setList(TIME_OFF_KEY, list);
    closeRequestModal();
    refreshCalendar();
    if (isAdmin()) drawAdminTotals(new Date().getFullYear());
    return;
  }

  // Approve or pending per rules
  const rec = check.record;
  const list = getList(TIME_OFF_KEY);
  list.push(rec);
  setList(TIME_OFF_KEY, list);

  // Deduct balances (strict) for approved PTO/SICK
  const empIdx = EMPLOYEES.findIndex(e => String(e.id) === String(rec.employeeId));
  if (empIdx >= 0 && rec.status === 'approved') {
    if (rec.kind === 'PTO') {
      EMPLOYEES[empIdx].ptoHours = Math.max(0, Number(EMPLOYEES[empIdx].ptoHours || 0) - rec.hours);
    } else if (rec.kind === 'SICK') {
      EMPLOYEES[empIdx].pslHours = Math.max(0, Number(EMPLOYEES[empIdx].pslHours || 0) - rec.hours);
    }
    setList(EMPLOYEES_KEY, EMPLOYEES);
  }

  closeRequestModal();
  refreshCalendar();
  if (isAdmin()) drawAdminTotals(new Date().getFullYear());
  alert('Request approved.');
}

// ===== Export Week =====
function exportCurrentWeek() {
  if (!empCalendar) return;
  const view = empCalendar.view;
  const start = view.currentStart;
  const end = view.currentEnd;
  const events = empCalendar.getEvents().filter(ev => {
    return ev.start >= start && ev.start < end;
  });
  const lines = [];
  lines.push(['Start', 'End', 'Type', 'Employee', 'Status'].join(','));
  events.forEach(ev => {
    const r = ev.extendedProps.req || {};
    lines.push([
      ev.start.toISOString(),
      (ev.end || ev.start).toISOString(),
      typeLabel(r.kind || ''),
      employeeName((r.employeeId || '')),
      (r.status || '')
    ].map(csvEscape).join(','));
  });
  downloadText(`employee_schedule_week_${ymd(start)}.csv`, lines.join('\n'));
}

// ===== Wire up DOM =====
document.addEventListener('DOMContentLoaded', async () => {
  // NEW: try to sync roster from file first (no-op if file missing/offline)
  await syncEmployeesFromFile();

  // Calendar + legend
  initCalendar();
  renderLegend();

  // Admin panel
  renderAdminPanel();

  // Buttons
  document.getElementById('btn-request-off').addEventListener('click', openRequestModal);
  document.getElementById('btn-export-week').addEventListener('click', exportCurrentWeek);

  // Modal events
  document.getElementById('req-cancel').addEventListener('click', closeRequestModal);
  document.getElementById('req-fullday').addEventListener('change', toggleTimeInputs);

  // Form submit
  document.getElementById('request-form').addEventListener('submit', handleRequestSubmit);
});
