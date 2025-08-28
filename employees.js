/* Employee Schedule page logic (horizontal week grid)
 * - Weekly grid: days as rows (left), hours across top
 * - Time off shown as horizontal bars
 * - Legend, modal, strict rules, admin totals/export preserved
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

// Viewing window (07:00 → 18:00)
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

// ===== Horizontal Grid Rendering =====
let currentWeekStart = startOfWeek(new Date()); // Sunday of the current week

function totalViewMinutes(){ return (VIEW_END.h - VIEW_START.h)*60 + (VIEW_END.m - VIEW_START.m); }
function minutesSinceViewStart(date){
  const d=new Date(date);
  const start=new Date(d); start.setHours(VIEW_START.h, VIEW_START.m, 0, 0);
  const end=new Date(d); end.setHours(VIEW_END.h, VIEW_END.m, 0, 0);
  if(d<=start) return 0;
  if(d>=end) return totalViewMinutes();
  return Math.round((d - start)/60000);
}

function renderTitle(){
  const titleEl=document.getElementById('emp-title');
  const start=currentWeekStart;
  const end=addDays(start,6);
  const fmt = (dt)=> dt.toLocaleDateString(undefined,{month:'short', day:'numeric'});
  titleEl.textContent = `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
}

function renderHeader(container){
  container.innerHTML='';
  const totalMin = totalViewMinutes();
  for(let h=VIEW_START.h; h<=VIEW_END.h; h++){
    const leftPct = ((h - VIEW_START.h)*60)/totalMin*100;
    // vertical line at each hour
    const vline=document.createElement('div'); vline.className='vline'; vline.style.left=leftPct+'%';
    container.appendChild(vline);

    // centered label, with edge clamping for first/last hour
    const tick=document.createElement('div'); tick.className='tick'; tick.style.left = leftPct+'%';
    const lbl=document.createElement('div'); lbl.className='tick-label';
    const hour12 = ((h+11)%12)+1;
    lbl.textContent = hour12 + (h<12?'a':'p');
    if(h===VIEW_START.h){
      lbl.style.transform = 'translate(0,-50%)';
      lbl.style.textAlign = 'left';
    } else if (h===VIEW_END.h){
      lbl.style.transform = 'translate(-100%,-50%)';
      lbl.style.textAlign = 'right';
    }
    tick.appendChild(lbl);
    container.appendChild(tick);
  }
}

function renderTrackGuides(trackEl){
  const totalMin = totalViewMinutes();
  for(let h=VIEW_START.h; h<=VIEW_END.h; h++){
    const leftPct = ((h - VIEW_START.h)*60)/totalMin*100;
    const vline=document.createElement('div'); vline.className='vline'; vline.style.left=leftPct+'%';
    trackEl.appendChild(vline);
  }
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
  wrap.innerHTML='';

  // Sticky header
  const head=document.createElement('div');
  head.className='head';
  const left=document.createElement('div'); left.className='left'; left.textContent='';
  const times=document.createElement('div'); times.className='times';
  renderHeader(times);
  head.appendChild(left); head.appendChild(times);
  wrap.appendChild(head);

  // Body rows (7 days)
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

    // Render bars for requests on this day
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
  const listEl=document.getElementById('emp-legend-list'); listEl.innerHTML='';
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
  modal.el.style.display='flex';
}
function closeRequestModal(){ modal.el.style.display='none'; }

function populateRequestEmployees(){
  const sel=document.getElementById('req-employee'); sel.innerHTML='';
  EMPLOYEES.forEach(e=>{ const opt=document.createElement('option'); opt.value=e.id; opt.textContent=`${e.name} (${e.position||''})`; sel.appendChild(opt); });
  const curId=getCurrentUserId(); if(curId && EMPLOYEES.some(e=>String(e.id)===String(curId))) sel.value=curId;
  sel.disabled=false; // allow selection by anyone
}
function toggleTimeInputs(){ const full=document.getElementById('req-fullday').value==='yes'; document.getElementById('req-start-time').disabled=full; document.getElementById('req-end-time').disabled=full; }

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
  const startISO=new Date(`${form.startDate}T${full?'08:00':form.startTime}`).toISOString();
  const endISO=new Date(`${form.endDate}T${full?'18:00':form.endTime}`).toISOString(); // clamp UI default to 6p when full day
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
  if(!isAdmin()){ panel.style.display='none'; return; }
  panel.style.display='block';
  const yearSel=document.getElementById('adminYear'); const thisYear=new Date().getFullYear(); yearSel.innerHTML='';
  for(let y=thisYear-2; y<=thisYear+1; y++){ const opt=document.createElement('option'); opt.value=y; opt.textContent=y; if(y===thisYear) opt.selected=true; yearSel.appendChild(opt); }
  yearSel.onchange=()=>drawAdminTotals(Number(yearSel.value)); drawAdminTotals(thisYear);
  document.getElementById('btn-export-admin').onclick=()=>{ const y=Number(yearSel.value); const csv=buildAdminCSV(y); downloadText(`employee_timeoff_totals_${y}.csv`, csv); };
}

function drawAdminTotals(year){
  const list=getList(TIME_OFF_KEY).filter(r=>{ const sY=new Date(r.startISO).getFullYear(), eY=new Date(r.endISO).getFullYear(); return sY===year||eY===year; });
  const byEmp=new Map(); EMPLOYEES.forEach(e=>byEmp.set(String(e.id),{name:e.name, position:e.position||'', ptoReqH:0,ptoAppH:0,ptoTakenH:0, sickReqH:0,sickAppH:0,sickTakenH:0}));
  list.forEach(r=>{ const k=String(r.employeeId); if(!byEmp.has(k)) return; const b=byEmp.get(k); const hrs=Number(r.hours||0); const isPast=new Date(r.endISO)<new Date(); const kk=r.kind==='PTO'?'pto':r.kind==='SICK'?'sick':null;
    if(!kk) return; b[`${kk}ReqH`]+=hrs; if(r.status==='approved') b[`${kk}AppH`]+=hrs; if(isPast && r.status==='approved') b[`${kk}TakenH`]+=hrs; });
  const el=document.getElementById('adminTotals'); const rows=[];
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

// ===== Wire up =====
document.addEventListener('DOMContentLoaded', async ()=>{
  await syncEmployeesFromFile();
  renderLegend();
  renderAdminPanel();
  renderTitle();
  renderGrid();

  document.getElementById('emp-prev').addEventListener('click', prevWeek);
  document.getElementById('emp-next').addEventListener('click', nextWeek);
  document.getElementById('emp-today').addEventListener('click', todayWeek);

  document.getElementById('btn-request-off').addEventListener('click', openRequestModal);
  document.getElementById('btn-export-week').addEventListener('click', exportCurrentWeek);
  document.getElementById('req-cancel').addEventListener('click', closeRequestModal);
  document.getElementById('req-fullday').addEventListener('change', toggleTimeInputs);
  document.getElementById('request-form').addEventListener('submit', handleRequestSubmit);
});
