/* Employee Schedule page logic (horizontal week grid with stacking lanes)
 * - Days are rows, hours across top (7a–6p)
 * - Baseline weekly shifts (from data/weekly_shifts.json) render behind time-off
 * - Time-off policy, admin totals/export preserved
 * - Per-day lane stacking using a lane map to avoid overlaps
 */

ensureLoggedIn();

// ===== Constants & Policy =====
const HOURS_PER_DAY = 8;
const POLICY = {
  summer: { startMonth: 6, startDay: 1, endMonth: 9, endDay: 30, ptoCapDays: 3 },
  leadTimeDaysForPTO: 14,
  hoursPerFullDay: HOURS_PER_DAY
};
const TIME_OFF_KEY = 'timeOffRequests';
const EMPLOYEES_KEY = 'employees';

// Time axis (07:00 → 18:00)
const VIEW_START = { h:7, m:0 };
const VIEW_END   = { h:18, m:0 };

// ===== Admin / Current user helpers =====
function isAdmin() {
  try { const p = new URLSearchParams(location.search); if (p.get('admin') === '1') return true; } catch {}
  return localStorage.getItem('currentUserIsAdmin') === 'true' || localStorage.getItem('isAdmin') === 'true';
}
function getCurrentUserId() { return localStorage.getItem('currentUserId') || localStorage.getItem('userId') || null; }

// ===== Utils =====
function ymd(d){ const dt=new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }
function dayDiffInclusive(s,e){ const S=new Date(ymd(s)), E=new Date(ymd(e)); return Math.floor((E-S)/86400000)+1; }
function hoursBetween(s,e){ return Math.max(0,(new Date(e)-new Date(s))/3600000); }
function inSummerWindow(d){ const y=d.getFullYear(); const s=new Date(y,5,1), e=new Date(y,8,30,23,59,59,999); return d>=s && d<=e; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function startOfWeek(d){ const x=new Date(d); x.setHours(0,0,0,0); const dow=x.getDay(); x.setDate(x.getDate()-dow); return x; } // Sunday
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// Storage wrappers
function getList(key){ try{ if(typeof getItems==='function') return getItems(key);}catch{} return JSON.parse(localStorage.getItem(key)||'[]'); }
function setList(key,arr){ localStorage.setItem(key, JSON.stringify(arr||[])); }

// ---- Color helpers for shift bars ----
function getEmployeeColorById(empId){
  const emp = EMPLOYEES.find(e => String(e.id) === String(empId));
  return emp && emp.color ? String(emp.color) : null;
}
function hexToRgba(hex, alpha){
  if(!hex) return null;
  let h = String(hex).trim();
  if(h[0] === '#') h = h.slice(1);
  if(h.length === 3){ h = h.split('').map(c=>c+c).join(''); }
  if(!/^([0-9a-fA-F]{6})$/.test(h)) return hex; // fallback to original if not hex
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  const a = (alpha==null?1:alpha);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}


// ===== Data load & roster =====
let EMPLOYEES = getList(EMPLOYEES_KEY);
async function syncEmployeesFromFile(){
  try{
    const res=await fetch('data/employees.json',{cache:'no-store'});
    if(!res.ok) throw new Error('fetch failed');
    const data=await res.json();
    if(Array.isArray(data)){ localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(data)); EMPLOYEES = getList(EMPLOYEES_KEY); }
  }catch(e){ console.warn('Roster sync skipped:', e.message||e); }
}
function employeeName(id){ const e=EMPLOYEES.find(x=>String(x.id)===String(id)); return e?e.name:`Emp ${id}`; }
function typeLabel(k){ return k==='PTO'?'PTO':k==='SICK'?'Sick':k; }

// ===== Weekly shifts support =====
const WEEKLY_SHIFTS_KEY = 'weeklyShifts';
let WEEKLY_SHIFTS = JSON.parse(localStorage.getItem(WEEKLY_SHIFTS_KEY) || '{"data":[]}');
async function syncWeeklyShiftsFromFile(){
  try{
    const res = await fetch('data/weekly_shifts.json', {cache:'no-store'});
    if(!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    if(data && Array.isArray(data.data)){
      WEEKLY_SHIFTS = data;
      localStorage.setItem(WEEKLY_SHIFTS_KEY, JSON.stringify(WEEKLY_SHIFTS));
    }
  }catch(e){ console.warn('Weekly shifts sync skipped:', e.message||e); }
}
function findEmployeeIdByNameCaseInsensitive(name){
  if(!name) return null;
  const norm = String(name).trim().toLowerCase();
  const hit = EMPLOYEES.find(e => String(e.name).trim().toLowerCase() === norm);
  // Handle known misspelling for Bri just in case
  if(!hit && norm.replace(/\s+/g,'') === 'brigalagher'){
    const h2 = EMPLOYEES.find(e => String(e.name).trim().toLowerCase() === 'bri ghallager'.replace(/\s+/g,' '));
    if(h2) return h2.id;
  }
  return hit ? hit.id : null;
}

// ===== Horizontal Grid Rendering =====
let currentWeekStart = startOfWeek(new Date()); // Sunday of the current week

function totalViewMinutes(){ return (VIEW_END.h - VIEW_START.h)*60 + (VIEW_END.m - VIEW_START.m); }
function minutesSinceViewStart(date){
  const d=new Date(date);
  const start=new Date(d); start.setHours(VIEW_START.h, VIEW_START.m, 0, 0);
  const end=new Date(d); end.setHours(VIEW_END.h, VIEW_END.m, 0, 0);
  if(d<=start) return 0;
  if(d>=end) return totalViewMinutes();
  // Use floor rather than round so a bar never spills past the
  // requested end time due to rounding up. Rounding caused some
  // shifts to display slightly beyond their actual end, e.g. showing
  // a 5:00 pm shift as extending to 5:30 pm. Flooring keeps the bar
  // strictly within the intended bounds.
  return Math.floor((d - start)/60000);
}

function renderTitle(){
  const titleEl=document.getElementById('emp-title');
  const start=currentWeekStart;
  const end=addDays(start,6);
  const fmt = (dt)=> dt.toLocaleDateString(undefined,{month:'short', day:'numeric'});
  if(titleEl) titleEl.textContent = `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}

function renderHeader(container){
  if(!container) return;
  container.innerHTML='';
  const totalMin = totalViewMinutes();
  for(let h=VIEW_START.h; h<=VIEW_END.h; h++){
    const leftPct = ((h - VIEW_START.h)*60)/totalMin*100;
    const vline=document.createElement('div'); vline.className='vline'; vline.style.left=leftPct+'%';
    container.appendChild(vline);

    const tick=document.createElement('div'); tick.className='tick'; tick.style.left = leftPct+'%';
    const lbl=document.createElement('div'); lbl.className='tick-label';
    const hour12 = ((h+11)%12)+1;
    lbl.textContent = hour12 + (h<12?'a':'p');
    if(h===VIEW_START.h){
      lbl.style.transform = 'translate(0,-50%)'; lbl.style.textAlign = 'left';
    } else if (h===VIEW_END.h){
      lbl.style.transform = 'translate(-100%,-50%)'; lbl.style.textAlign = 'right';
    }
    tick.appendChild(lbl);
    container.appendChild(tick);
  }
}

function renderTrackGuides(trackEl){
  if(!trackEl) return;
  const totalMin = totalViewMinutes();
  for(let h=VIEW_START.h; h<=VIEW_END.h; h++){
    const leftPct = ((h - VIEW_START.h)*60)/totalMin*100;
    const vline=document.createElement('div'); vline.className='vline'; vline.style.left=leftPct+'%';
    trackEl.appendChild(vline);
  }
}

// ===== Lane helpers (stack bars per-employee within each day) =====
function buildDayLanes(dayDate, events){
  const ids = new Set();
  // Collect from shifts
  try{
    (WEEKLY_SHIFTS.data||[]).forEach(person=>{
      const empId = findEmployeeIdByNameCaseInsensitive(person.employeeName);
      if(!empId) return;
      (person.shifts||[]).forEach(shift=>{
        if(Number(shift.weekday) === dayDate.getDay()) ids.add(String(empId));
      });
    });
  }catch(_e){}
  // Collect from requests with a segment that day
  try{
    events.forEach(req=>{
      splitRequestIntoDailySegments(req).forEach(seg=>{
        if(seg.day.toDateString() === dayDate.toDateString()){
          ids.add(String(req.employeeId));
        }
      });
    });
  }catch(_e){}
  // Stable order: by roster order
  const order = new Map(EMPLOYEES.map((e,i)=>[String(e.id), i]));
  const lanes = Array.from(ids);
  lanes.sort((a,b)=> (order.get(String(a))??999) - (order.get(String(b))??999) || String(a).localeCompare(String(b)));
  return lanes;
}
function laneMetrics(){
  const root = document.querySelector('.emp-schedule');
  const cs = root ? getComputedStyle(root) : null;
  const laneH = cs ? parseFloat(cs.getPropertyValue('--lane-h')) : 24;
  const gap   = cs ? parseFloat(cs.getPropertyValue('--lane-gap')) : 6;
  const pad   = cs ? parseFloat(cs.getPropertyValue('--row-pad')) : 6;
  return {laneH, gap, pad};
}
function laneTopPx(laneIndex){
  const {laneH, gap, pad} = laneMetrics();
  return Math.round(pad + laneIndex * (laneH + gap));
}
function trackHeightForLanes(count){
  const {laneH, gap, pad} = laneMetrics();
  if (count <= 0) return Math.round(pad*2 + laneH);
  return Math.round(pad*2 + count*laneH + Math.max(0, count-1)*gap);
}

function splitRequestIntoDailySegments(req){
  const out=[];
  const s=new Date(req.startISO), e=new Date(req.endISO);
  for(let d=new Date(s.getFullYear(), s.getMonth(), s.getDate()); d<=e; d=addDays(d,1)){
    const dayStart = new Date(d); dayStart.setHours(VIEW_START.h, VIEW_START.m, 0, 0);
    const dayEnd   = new Date(d); dayEnd.setHours(VIEW_END.h, VIEW_END.m, 0, 0);
    const segStart = new Date(Math.max(dayStart.getTime(), (d.toDateString()===s.toDateString()? s : dayStart).getTime()));
    const segEnd   = new Date(Math.min(dayEnd.getTime(),   (d.toDateString()===e.toDateString()? e : dayEnd).getTime()));
    if(segEnd > segStart){ out.push({ day: new Date(d), start: segStart, end: segEnd }); }
  }
  return out;
}

function renderGrid(){
  const wrap=document.getElementById('emp-grid');
  if(!wrap) return;
  wrap.innerHTML='';

  const head=document.createElement('div');
  head.className='head';
  const left=document.createElement('div'); left.className='left'; left.textContent='';
  const times=document.createElement('div'); times.className='times';
  renderHeader(times);
  head.appendChild(left); head.appendChild(times);
  wrap.appendChild(head);

  const body=document.createElement('div'); body.className='body';
  wrap.appendChild(body);

  const totalMin = totalViewMinutes();
  const events = getList(TIME_OFF_KEY);

  for(let i=0;i<7;i++){
    const dayDate = addDays(currentWeekStart, i);
    const row=document.createElement('div'); row.className='day-row';

    const label=document.createElement('div'); label.className='day-cell';
    const dow = dayDate.toLocaleDateString(undefined, {weekday:'short'});
    label.innerHTML = `<div>${dow}<br>${dayDate.toLocaleDateString(undefined,{month:'numeric', day:'numeric'})}</div>`;

    const track=document.createElement('div'); track.className='track';
    renderTrackGuides(track);

    // Determine lanes and set track height
    const lanes = buildDayLanes(dayDate, events);
    track.style.height = trackHeightForLanes(lanes.length) + 'px';
    // Build lane map so everything (including any fallback) gets its own lane
    const laneMap = new Map(lanes.map((id, idx) => [String(id), idx]));
    function laneIndexFor(key){
      const k = String(key);
      if (laneMap.has(k)) return laneMap.get(k);
      const idx = laneMap.size;
      laneMap.set(k, idx);
      track.style.height = trackHeightForLanes(laneMap.size) + 'px';
      return idx;
    }

    // Baseline weekly shifts (background)
    try{
      (WEEKLY_SHIFTS.data||[]).forEach(person=>{
        (person.shifts||[]).forEach(shift=>{
          if(Number(shift.weekday) !== dayDate.getDay()) return;
          const sParts = String(shift.start||'07:00').split(':');
          const eParts = String(shift.end||'17:00').split(':');
          const segStart = new Date(dayDate); segStart.setHours(Number(sParts[0]||0), Number(sParts[1]||0), 0, 0);
          const segEnd   = new Date(dayDate); segEnd.setHours(Number(eParts[0]||0), Number(eParts[1]||0), 0, 0);
          const leftMin = minutesSinceViewStart(segStart);
          const rightMin= minutesSinceViewStart(segEnd);
          const l = clamp(leftMin, 0, totalMin);
          const w = clamp(rightMin, 0, totalMin) - l;
          if(w <= 0) return;
          const bar=document.createElement('div');
          bar.className='shift-bar';
          bar.style.left = (l/totalMin*100)+'%';
          bar.style.width= (w/totalMin*100)+'%';
          const empId = findEmployeeIdByNameCaseInsensitive(person.employeeName);
          const label = empId ? employeeName(empId) : (person.employeeName||'');
          const laneIndex = empId ? laneIndexFor(empId) : laneIndexFor('name:'+label);
          bar.style.top = laneTopPx(laneIndex) + 'px';
          // Apply employee color to baseline shift bar
          const empColor = empId ? getEmployeeColorById(empId) : null;
          if (empColor) {
            bar.style.backgroundColor = hexToRgba(empColor, 0.20);
            bar.style.borderColor = hexToRgba(empColor, 0.38);
          }
          bar.title = `Shift • ${label} ${String(shift.start)}–${String(shift.end)}`;
          bar.textContent = label;
          track.appendChild(bar);
        });
      });
    }catch(_e){}

    // Time-off bars (overlay in same lane as the employee)
    events.forEach(req=>{
      splitRequestIntoDailySegments(req).forEach(seg=>{
        if(seg.day.toDateString() !== dayDate.toDateString()) return;
        const leftMin = minutesSinceViewStart(seg.start);
        const rightMin= minutesSinceViewStart(seg.end);
        const l = clamp(leftMin, 0, totalMin);
        const w = clamp(rightMin, 0, totalMin) - l;
        if(w <= 0) return;

        const bar=document.createElement('div');
        const kind = (req.kind||'OTHER').toUpperCase();
        bar.className='emp-bar ' + (kind==='PTO'?'pto':kind==='SICK'?'sick':'other');
        bar.style.left = (l/totalMin*100)+'%';
        bar.style.width= (w/totalMin*100)+'%';
        const laneIndex = laneIndexFor(req.employeeId);
        bar.style.top = laneTopPx(laneIndex) + 'px';
        bar.title = `${typeLabel(req.kind)} • ${employeeName(req.employeeId)}\n${seg.start.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} – ${seg.end.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
        bar.textContent = `${typeLabel(req.kind)} – ${employeeName(req.employeeId)}`;
        track.appendChild(bar);
      });
    });

    row.appendChild(label);
    row.appendChild(track);
    body.appendChild(row);
  }
}

function prevWeek(){ currentWeekStart = addDays(currentWeekStart, -7); renderTitle(); renderGrid(); }
function nextWeek(){ currentWeekStart = addDays(currentWeekStart, +7); renderTitle(); renderGrid(); }
function todayWeek(){ currentWeekStart = startOfWeek(new Date()); renderTitle(); renderGrid(); }

// ===== Legend =====
function renderLegend(){
  const listEl=document.getElementById('emp-legend-list'); if(!listEl) return;
  listEl.innerHTML='';
  if(!EMPLOYEES.length){ listEl.innerHTML='<div>No employees found.</div>'; return; }
  EMPLOYEES.forEach(emp=>{
    const row=document.createElement('div'); row.className='legend-item';
    const sw=document.createElement('span'); sw.className='legend-color'; sw.style.display='inline-block'; sw.style.width='10px'; sw.style.height='10px'; sw.style.borderRadius='2px'; sw.style.marginRight='8px'; sw.style.backgroundColor=emp.color||'#4577D5';
    const label=document.createElement('span'); label.innerHTML=`<strong>${emp.name}</strong> &nbsp; <span style="opacity:.8">${emp.position||''}</span>`;
    row.appendChild(sw); row.appendChild(label); listEl.appendChild(row);
  });
}

// ===== Modal & Request handling =====
const modal={ el:document.getElementById('request-modal'), form:null };
function openRequestModal(){
  populateRequestEmployees();
  const today=new Date();
  document.getElementById('req-start-date').value=ymd(today);
  document.getElementById('req-end-date').value=ymd(today);
  document.getElementById('req-start-time').value='08:00';
  document.getElementById('req-end-time').value='16:00';
  document.getElementById('req-fullday').value='yes';
  toggleTimeInputs();
  if(modal.el) modal.el.style.display='flex';
}
function closeRequestModal(){ if(modal.el) modal.el.style.display='none'; }

function populateRequestEmployees(){
  const sel=document.getElementById('req-employee'); if(!sel) return;
  sel.innerHTML='';
  EMPLOYEES.forEach(e=>{ const opt=document.createElement('option'); opt.value=e.id; opt.textContent=`${e.name} (${e.position||''})`; sel.appendChild(opt); });
  const curId=getCurrentUserId(); if(curId && EMPLOYEES.some(e=>String(e.id)===String(curId))) sel.value=curId;
  sel.disabled=false;
}
function toggleTimeInputs(){ const full=document.getElementById('req-fullday') && document.getElementById('req-fullday').value==='yes'; const st=document.getElementById('req-start-time'), et=document.getElementById('req-end-time'); if(st) st.disabled=full; if(et) et.disabled=full; }

function handleRequestSubmit(ev){
  ev.preventDefault();
  const form = {
    type: document.getElementById('req-type').value,
    employeeId: document.getElementById('req-employee').value,
    fullDay: document.getElementById('req-fullday').value === 'yes',
    startDate: document.getElementById('req-start-date').value,
    endDate: document.getElementById('req-end-date').value,
    startTime: document.getElementById('req-start-time').value,
    endTime: document.getElementById('req-end-time').value,
    notes: document.getElementById('req-notes').value
  };

  const chk = strictCheckAndBuildRecord(form);
  if (!chk.ok) {
    alert('Not approved:\n' + chk.reasons.join('\n'));
    return;
  }

  const list = getList(TIME_OFF_KEY);
  list.push(chk.record);
  setList(TIME_OFF_KEY, list);

  const emp = EMPLOYEES.find(e => String(e.id) === String(chk.record.employeeId));
  if (emp) {
    if (chk.record.kind === 'PTO') {
      emp.ptoHours = Math.max(0, Number(emp.ptoHours || 0) - Number(chk.record.hours || 0));
    } else if (chk.record.kind === 'SICK') {
      emp.pslHours = Math.max(0, Number(emp.pslHours || 0) - Number(chk.record.hours || 0));
    }
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(EMPLOYEES));
  }

  closeRequestModal();
  renderGrid();
  renderAdminPanel();
}

// ===== Strict checks =====
function strictCheckAndBuildRecord(form){
  const kind=form.type, employeeId=form.employeeId, full=form.fullDay;
  // Use the full view span for full-day requests so the bar covers the entire day.
  const fullStart=`${String(VIEW_START.h).padStart(2,'0')}:${String(VIEW_START.m).padStart(2,'0')}`;
  const fullEnd=`${String(VIEW_END.h).padStart(2,'0')}:${String(VIEW_END.m).padStart(2,'0')}`;
  const startISO=new Date(`${form.startDate}T${full?fullStart:form.startTime}`).toISOString();
  const endISO=new Date(`${form.endDate}T${full?fullEnd:form.endTime}`).toISOString();
  if(new Date(endISO)<=new Date(startISO)) return {ok:false, reasons:['End must be after start']};
  const emp=EMPLOYEES.find(e=>String(e.id)===String(employeeId)); if(!emp) return {ok:false, reasons:['Employee not found']};

  let hours = full ? dayDiffInclusive(form.startDate, form.endDate)*POLICY.hoursPerFullDay : Math.max(0.5, hoursBetween(startISO,endISO));
  const sD=new Date(form.startDate), eD=new Date(form.endDate);

  if(kind==='PTO'){
    const today=new Date(), msLead=POLICY.leadTimeDaysForPTO*86400000;
    if(sD - today < msLead) return {ok:false, reasons:[`PTO requires at least ${POLICY.leadTimeDaysForPTO} days of notice`]};
    const anySummer = inSummerWindow(sD)||inSummerWindow(eD);
    if(anySummer){
      const used = countEmployeeSummerPTODays(employeeId, sD.getFullYear());
      const reqDays = full ? dayDiffInclusive(form.startDate, form.endDate) : Math.ceil(hours/POLICY.hoursPerFullDay);
      if(used + reqDays > POLICY.summer.ptoCapDays) return {ok:false, reasons:[`Summer PTO cap of ${POLICY.summer.ptoCapDays} day(s) exceeded`]};
    }
    const ptoAvail=Number(emp.ptoHours||0); if(hours>ptoAvail) return {ok:false, reasons:['Insufficient PTO balance']};
  }

  if(kind==='SICK'){
    const pslAvail=Number(emp.pslHours||0); if(hours>pslAvail) return {ok:false, reasons:['Insufficient WA Paid Sick Leave balance']};
  }

  let status='approved', verificationNeeded=false;
  if(kind==='SICK'){
    const daysReq = full ? dayDiffInclusive(form.startDate, form.endDate) : Math.ceil(hours/POLICY.hoursPerFullDay);
    if(daysReq>3) verificationNeeded=true;
  }

  return { ok:true, record:{
    id: (crypto.randomUUID ? crypto.randomUUID() : 'id-'+Math.random().toString(36).slice(2)),
    employeeId, kind, startISO, endISO, hours, notes:form.notes||'', status,
    createdAtISO:new Date().toISOString(), verificationNeeded
  }};
}

function countEmployeeSummerPTODays(employeeId, year){
  const list=getList(TIME_OFF_KEY); let total=0;
  list.forEach(req=>{
    if(String(req.employeeId)!==String(employeeId)) return;
    if(req.kind!=='PTO') return;
    const s=new Date(req.startISO), e=new Date(req.endISO);
    if(s.getFullYear()!==year && e.getFullYear()!==year) return;
    for(let d=new Date(s); d<=e; d=new Date(d.getTime()+86400000)){ if(inSummerWindow(d)) total+=1; }
  });
  return total;
}

// ===== Admin Panel =====
function renderAdminPanel(){
  const panel=document.getElementById('admin-panel');
  if(!panel) return;
  if(!isAdmin()){ panel.style.display='none'; return; }
  panel.style.display='block';
  const yearSel=document.getElementById('adminYear'); const thisYear=new Date().getFullYear(); if(yearSel) yearSel.innerHTML='';
  if(yearSel){
    for(let y=thisYear-2; y<=thisYear+1; y++){ const opt=document.createElement('option'); opt.value=y; opt.textContent=y; if(y===thisYear) opt.selected=true; yearSel.appendChild(opt); }
    yearSel.onchange=()=>drawAdminTotals(Number(yearSel.value)); drawAdminTotals(thisYear);
    const exportBtn = document.getElementById('btn-export-admin'); if(exportBtn) exportBtn.onclick=()=>{ const y=Number(yearSel.value); const csv=buildAdminCSV(y); downloadText(`employee_timeoff_totals_${y}.csv`, csv); };
  }
}

function drawAdminTotals(year){
  const el=document.getElementById('adminTotals'); if(!el) return;
  const list=getList(TIME_OFF_KEY).filter(r=>{ const sY=new Date(r.startISO).getFullYear(), eY=new Date(r.endISO).getFullYear(); return sY===year||eY===year; });
  const byEmp=new Map(); EMPLOYEES.forEach(e=>byEmp.set(String(e.id),{name:e.name, position:e.position||'', ptoReqH:0,ptoAppH:0,ptoTakenH:0, sickReqH:0,sickAppH:0,sickTakenH:0}));
  list.forEach(r=>{ const k=String(r.employeeId); if(!byEmp.has(k)) return; const b=byEmp.get(k); const hrs=Number(r.hours||0); const isPast=new Date(r.endISO)<new Date(); const kk=r.kind==='PTO'?'pto':r.kind==='SICK'?'sick':null;
    if(!kk) return; b[`${kk}ReqH`]+=hrs; if(r.status==='approved') b[`${kk}AppH`]+=hrs; if(isPast && r.status==='approved') b[`${kk}TakenH`]+=hrs; });
  const rows=[];
  rows.push(`<div style="display:grid;grid-template-columns:1.2fr .8fr repeat(3,1fr) / 1fr;gap:6px;font-weight:600;"><div>Employee</div><div>Position</div><div>Requested (hrs)</div><div>Approved (hrs)</div><div>Taken (hrs)</div></div>`);
  byEmp.forEach(v=>{ const req=v.ptoReqH+v.sickReqH, app=v.ptoAppH+v.sickAppH, tak=v.ptoTakenH+v.sickTakenH;
    rows.push(`<div style="display:grid;grid-template-columns:1.2fr .8fr repeat(3,1fr);gap:6px;"><div>${escapeHtml(v.name)}</div><div>${escapeHtml(v.position)}</div><div>${req.toFixed(1)}</div><div>${app.toFixed(1)}</div><div>${tak.toFixed(1)}</div></div>`); });
  el.innerHTML=rows.join('');
}
function buildAdminCSV(year){
  const lines=[['Year','Employee','Position','Requested (hrs)','Approved (hrs)','Taken (hrs)'].join(',')];
  const el=document.createElement('div'); el.innerHTML=document.getElementById('adminTotals').innerHTML;
  const rows=Array.from(el.querySelectorAll('div')).slice(1);
  rows.forEach(row=>{ const cols=row.querySelectorAll('div'); if(cols.length<5) return; lines.push([year, cols[0].textContent, cols[1].textContent, cols[2].textContent, cols[3].textContent, cols[4].textContent].map(csvEscape).join(',')); });
  return lines.join('\n');
}
function downloadText(fn, text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=fn; a.click(); }
function csvEscape(s){ s=String(s||''); if(s.includes(',')||s.includes('"')||s.includes('\n')) return '"'+s.replace(/"/g,'""')+'"'; return s; }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

// ===== Export week =====
function exportCurrentWeek(){
  const start=new Date(currentWeekStart), end=addDays(currentWeekStart,7);
  const events=getList(TIME_OFF_KEY).filter(r=>{ const s=new Date(r.startISO), e=new Date(r.endISO); return e>=start && s<end; });
  const lines=[['Start','End','Type','Employee','Status'].join(',')];
  events.forEach(r=>{ lines.push([ new Date(r.startISO).toISOString(), new Date(r.endISO).toISOString(), typeLabel(r.kind||''), employeeName((r.employeeId||'')), (r.status||'') ].map(csvEscape).join(',')); });
  downloadText(`employee_schedule_week_${ymd(start)}.csv`, lines.join('\n'));
}

// ===== Wire up (defensive) =====
document.addEventListener('DOMContentLoaded', async ()=>{
  try {
    await syncEmployeesFromFile();
    await syncWeeklyShiftsFromFile();
    renderLegend();
    renderAdminPanel();
    renderTitle();
    renderGrid();

    const prev = document.getElementById('emp-prev');
    const next = document.getElementById('emp-next');
    const today = document.getElementById('emp-today');
    if (prev) prev.addEventListener('click', prevWeek);
    if (next) next.addEventListener('click', nextWeek);
    if (today) today.addEventListener('click', todayWeek);

    const reqBtn = document.getElementById('btn-request-off');
    const expBtn = document.getElementById('btn-export-week');
    if (reqBtn) reqBtn.addEventListener('click', openRequestModal);
    if (expBtn) expBtn.addEventListener('click', exportCurrentWeek);

    const cancel = document.getElementById('req-cancel');
    const fullSel = document.getElementById('req-fullday');
    const formEl = document.getElementById('request-form');
    if (cancel) cancel.addEventListener('click', closeRequestModal);
    if (fullSel) fullSel.addEventListener('change', toggleTimeInputs);
    if (formEl) formEl.addEventListener('submit', handleRequestSubmit);
  } catch (e) {
    console.error('Init error:', e);
  }
});
