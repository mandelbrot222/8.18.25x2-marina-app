/* Employee Schedule page logic
 * - Weekly calendar with time-off overlays
 * - Legend of employees
 * - Strict time-off rules
 * - Admin panel totals
 * - Roster sync from data/employees.json
 * - Admin now tied to login only
 */

ensureLoggedIn();

const HOURS_PER_DAY = 8;
const POLICY = {
  summer: { startMonth: 6, startDay: 1, endMonth: 9, endDay: 30, ptoCapDays: 3 },
  leadTimeDaysForPTO: 14,
  hoursPerFullDay: HOURS_PER_DAY
};
const TIME_OFF_KEY = 'timeOffRequests';
const EMPLOYEES_KEY = 'employees';

function isAdmin() { return localStorage.getItem('currentUserIsAdmin') === 'true'; }
function getCurrentUserId() { return localStorage.getItem('currentUserId') || null; }

function ymd(d){ const dt=new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }
function dayDiffInclusive(s,e){ const S=new Date(ymd(s)), E=new Date(ymd(e)); return Math.floor((E-S)/86400000)+1; }
function hoursBetween(s,e){ return Math.max(0,(new Date(e)-new Date(s))/3600000); }
function inSummerWindow(d){ const y=d.getFullYear(); const s=new Date(y,5,1), e=new Date(y,8,30,23,59,59,999); return d>=s && d<=e; }

function getList(k){ try{ if(typeof getItems==='function') return getItems(k);}catch{} return JSON.parse(localStorage.getItem(k)||'[]'); }
function setList(k,a){ localStorage.setItem(k, JSON.stringify(a||[])); }

let EMPLOYEES = getList(EMPLOYEES_KEY);
const TIME_OFF = getList(TIME_OFF_KEY);

async function syncEmployeesFromFile(){
  try{
    const res = await fetch('data/employees.json', {cache:'no-store'});
    if(!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    if(Array.isArray(data)){
      localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(data));
      EMPLOYEES = getList(EMPLOYEES_KEY);
    }
  }catch(e){
    console.warn('Roster sync skipped:', e.message||e);
  }
}

// Calendar
let empCalendar=null;
function typeLabel(k){ return k==='PTO'?'PTO':k==='SICK'?'Sick':k==='PFML'?'PFML':k; }
function employeeName(id){ const e=EMPLOYEES.find(x=>String(x.id)===String(id)); return e?e.name:`Emp ${id}`; }
function toCalendarEvents(){
  return getList(TIME_OFF_KEY).map(req=>{
    const c={PTO:'#007F7E',SICK:'#E67E22',PFML:'#8F4E9F'};
    return { title:`${typeLabel(req.kind)} - ${employeeName(req.employeeId)}`, start:req.startISO, end:req.endISO,
      backgroundColor:c[req.kind]||'#7A7A7A', borderColor:c[req.kind]||'#7A7A7A', opacity:req.status==='denied'?0.4:1, extendedProps:{req} };
  });
}
function initCalendar(){
  const el=document.getElementById('employee-calendar'); if(!el) return;
  empCalendar=new FullCalendar.Calendar(el,{
    initialView:'timeGridWeek', height:'auto',
    dayHeaderContent:(arg)=>{
      const dow=arg.date.toLocaleDateString([],{weekday:'short'});
      const m=String(arg.date.getMonth()+1), d=String(arg.date.getDate());
      return {html:`<div class="nm-dow">${dow}</div><div class="nm-date">${m}/${d}</div>`};
    },
    headerToolbar:{left:'prev,next today',center:'title',right:''},
    slotDuration:'00:30:00', slotMinTime:'07:00:00', slotMaxTime:'16:00:00', allDaySlot:false,
    events:toCalendarEvents(),
    eventClick:(info)=>{
      const r=info.event.extendedProps.req||{};
      alert(`${typeLabel(r.kind)} for ${employeeName(r.employeeId)}\n${new Date(r.startISO).toLocaleString()} → ${new Date(r.endISO).toLocaleString()}\nStatus: ${r.status}${r.verificationNeeded?' (verification may be required)':''}`);
    }
  }); empCalendar.render();
}
function refreshCalendar(){ if(!empCalendar) return; empCalendar.removeAllEvents(); toCalendarEvents().forEach(ev=>empCalendar.addEvent(ev)); }

// Legend
function renderLegend(){
  const listEl=document.getElementById('emp-legend-list'); listEl.innerHTML='';
  if(!EMPLOYEES.length){ listEl.innerHTML='<div>No employees found.</div>'; return; }
  EMPLOYEES.forEach(emp=>{
    const row=document.createElement('div'); row.className='legend-item';
    const sw=document.createElement('span'); sw.className='legend-color'; sw.style.backgroundColor=emp.color||'#4577D5';
    const label=document.createElement('span'); label.innerHTML=`<strong>${emp.name}</strong> &nbsp; <span style="opacity:.8">${emp.position||''}</span>`;
    row.appendChild(sw); row.appendChild(label); listEl.appendChild(row);
  });
}

// Modal & request
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
  const curId=getCurrentUserId();
  EMPLOYEES.forEach(e=>{ const opt=document.createElement('option'); opt.value=e.id; opt.textContent=`${e.name} (${e.position||''})`; sel.appendChild(opt); });
  if(curId && EMPLOYEES.some(e=>String(e.id)===String(curId))){ sel.value=curId; if(!isAdmin()) sel.disabled=true; }
  else { sel.disabled = isAdmin() ? false : (EMPLOYEES.length<=1 ? false : true); }
}
function toggleTimeInputs(){ const full=document.getElementById('req-fullday').value==='yes'; document.getElementById('req-start-time').disabled=full; document.getElementById('req-end-time').disabled=full; }

function strictCheckAndBuildRecord(form){
  const kind=form.type, employeeId=form.employeeId, full=form.fullDay;
  const startISO=new Date(`${form.startDate}T${full?'08:00':form.startTime}`).toISOString();
  const endISO=new Date(`${form.endDate}T${full?'16:00':form.endTime}`).toISOString();
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
  if(kind==='PFML') status='pending';
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

// Admin panel
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
  const byEmp=new Map(); EMPLOYEES.forEach(e=>byEmp.set(String(e.id),{name:e.name, position:e.position||'', ptoReqH:0,ptoAppH:0,ptoTakenH:0, sickReqH:0,sickAppH:0,sickTakenH:0, pfmlReqH:0,pfmlAppH:0,pfmlTakenH:0}));
  list.forEach(r=>{ const k=String(r.employeeId); if(!byEmp.has(k)) return; const b=byEmp.get(k); const hrs=Number(r.hours||0); const isPast=new Date(r.endISO)<new Date(); const kk=r.kind==='PTO'?'pto':r.kind==='SICK'?'sick':'pfml';
    b[`${kk}ReqH`]+=hrs; if(r.status==='approved') b[`${kk}AppH`]+=hrs; if(isPast && r.status==='approved') b[`${kk}TakenH`]+=hrs; });
  const el=document.getElementById('adminTotals'); const rows=[];
  rows.push(`<div style="display:grid;grid-template-columns:1.2fr .8fr repeat(3,1fr) / 1fr;gap:6px;font-weight:600;">
    <div>Employee</div><div>Position</div><div>Requested (hrs)</div><div>Approved (hrs)</div><div>Taken (hrs)</div></div>`);
  byEmp.forEach(v=>{ const req=v.ptoReqH+v.sickReqH+v.pfmlReqH, app=v.ptoAppH+v.sickAppH+v.pfmlAppH, tak=v.ptoTakenH+v.sickTakenH+v.pfmlTakenH;
    rows.push(`<div style="display:grid;grid-template-columns:1.2fr .8fr repeat(3,1fr);gap:6px;">
      <div>${escapeHtml(v.name)}</div><div>${escapeHtml(v.position)}</div>
      <div>${req.toFixed(1)}</div><div>${app.toFixed(1)}</div><div>${tak.toFixed(1)}</div></div>`); });
  el.innerHTML=rows.join('');
}
function buildAdminCSV(year){
  const lines=[['Year','Employee','Position','Requested (hrs)','Approved (hrs)','Taken (hrs)'].join(',')];
  const el=document.createElement('div'); el.innerHTML=document.getElementById('adminTotals').innerHTML;
  const rows=Array.from(el.querySelectorAll('div')).slice(1);
  rows.forEach(row=>{ const cols=row.querySelectorAll('div'); if(cols.length<5) return;
    lines.push([year, cols[0].textContent, cols[1].textContent, cols[2].textContent, cols[3].textContent, cols[4].textContent].map(csvEscape).join(',')); });
  return lines.join('\n');
}
function downloadText(fn, text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=fn; a.click(); }
function csvEscape(s){ s=String(s||''); if(s.includes(',')||s.includes('"')||s.includes('\n')) return '\"'+s.replace(/\"/g,'\"\"')+'\"'; return s; }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

function handleRequestSubmit(e){
  e.preventDefault();
  const kind=document.getElementById('req-type').value;
  const employeeId=document.getElementById('req-employee').value;
  const fullDay=document.getElementById('req-fullday').value==='yes';
  const startDate=document.getElementById('req-start-date').value;
  const endDate=document.getElementById('req-end-date').value;
  const startTime=document.getElementById('req-start-time').value;
  const endTime=document.getElementById('req-end-time').value;
  const notes=document.getElementById('req-notes').value.trim();

  const check=strictCheckAndBuildRecord({type:kind, employeeId, fullDay, startDate, endDate, startTime, endTime, notes});
  if(!check.ok){
    alert('Not approved under current policy:\n- '+check.reasons.join('\n- ')+'\n\nIf you still need this time off, please speak with your manager.');
    const deniedRecord={ id:(crypto.randomUUID?crypto.randomUUID():'id-'+Math.random().toString(36).slice(2)),
      employeeId, kind,
      startISO:new Date(`${startDate}T${fullDay?'08:00':startTime}`).toISOString(),
      endISO:new Date(`${endDate}T${fullDay?'16:00':endTime}`).toISOString(),
      hours: fullDay ? dayDiffInclusive(startDate,endDate)*POLICY.hoursPerFullDay : Math.max(0.5, hoursBetween(`${startDate}T${startTime}`, `${endDate}T${endTime}`)),
      notes, status:'denied', createdAtISO:new Date().toISOString() };
    const list=getList(TIME_OFF_KEY); list.push(deniedRecord); setList(TIME_OFF_KEY, list);
    closeRequestModal(); refreshCalendar(); if(isAdmin()) drawAdminTotals(new Date().getFullYear()); return;
  }

  const rec=check.record;
  const list=getList(TIME_OFF_KEY); list.push(rec); setList(TIME_OFF_KEY, list);
  const idx=EMPLOYEES.findIndex(e=>String(e.id)===String(rec.employeeId));
  if(idx>=0 && rec.status==='approved'){
    if(rec.kind==='PTO'){ EMPLOYEES[idx].ptoHours=Math.max(0, Number(EMPLOYEES[idx].ptoHours||0)-rec.hours); }
    else if(rec.kind==='SICK'){ EMPLOYEES[idx].pslHours=Math.max(0, Number(EMPLOYEES[idx].pslHours||0)-rec.hours); }
    setList(EMPLOYEES_KEY, EMPLOYEES);
  }
  closeRequestModal(); refreshCalendar(); if(isAdmin()) drawAdminTotals(new Date().getFullYear());
  alert(rec.kind==='PFML' ? 'Request recorded as pending (PFML).' : 'Request approved.');
}

function exportCurrentWeek(){
  if(!empCalendar) return;
  const v=empCalendar.view, start=v.currentStart, end=v.currentEnd;
  const events=empCalendar.getEvents().filter(ev=>ev.start>=start && ev.start<end);
  const lines=[['Start','End','Type','Employee','Status'].join(',')];
  events.forEach(ev=>{ const r=ev.extendedProps.req||{};
    lines.push([ev.start.toISOString(), (ev.end||ev.start).toISOString(), typeLabel(r.kind||''), employeeName((r.employeeId||'')), (r.status||'')].map(csvEscape).join(',')); });
  downloadText(`employee_schedule_week_${ymd(start)}.csv`, lines.join('\n'));
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await syncEmployeesFromFile();
  initCalendar(); renderLegend(); renderAdminPanel();
  document.getElementById('btn-request-off').addEventListener('click', openRequestModal);
  document.getElementById('btn-export-week').addEventListener('click', exportCurrentWeek);
  document.getElementById('req-cancel').addEventListener('click', closeRequestModal);
  document.getElementById('req-fullday').addEventListener('change', toggleTimeInputs);
  document.getElementById('request-form').addEventListener('submit', handleRequestSubmit);
});
