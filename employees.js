/*
 * Logic for the Employee Schedule page.  This script manages
 * adding and deleting employee shifts.  Each shift stores an
 * employee name, date, start time, end time and optional notes.
 */

// Protect the page for logged in users only
ensureLoggedIn();

const EMPLOYEE_KEY = 'employeeSchedules';

// FullCalendar instance for employee schedules
let employeeCalendar;
let employeeMiniCalendar;

/**
 * Convert employee schedules into FullCalendar events.  Each event uses
 * the employee name as the title and the start and end times to mark
 * the event duration.  Notes are appended to the title if provided.
 */
function transformEmployeeSchedulesToEvents() {
  return getItems(EMPLOYEE_KEY).map(item => ({
    title: item.name + (item.notes ? ' – ' + item.notes : ''),
    start: `${item.date}T${item.startTime}`,
    end: `${item.date}T${item.endTime}`
  }));
}

/**
 * Initialise the FullCalendar instance for employee schedules.
 */
function initEmployeeCalendar() {
  const calendarEl = document.getElementById('employee-calendar');
  if (!calendarEl) return;
  employeeCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    height: 'auto',
    events: transformEmployeeSchedulesToEvents(),
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    allDaySlot: false,
    eventOverlap: false,
    editable: false,
    datesSet: function(info) {
      if (employeeMiniCalendar) {
        employeeMiniCalendar.gotoDate(info.start);
      }
    }
  });
  employeeCalendar.render();
}

/**
 * Refresh events on the employee calendar.  Should be called after
 * adding or removing shifts.
 */
function refreshEmployeeCalendar() {
  if (employeeCalendar) {
    const events = transformEmployeeSchedulesToEvents();
    employeeCalendar.removeAllEvents();
    events.forEach(ev => employeeCalendar.addEvent(ev));
  }
}

/**
 * Render all employee schedules from localStorage to the DOM.  Also
 * updates the calendar.
 */
function renderEmployeeSchedules() {
  const list = getItems(EMPLOYEE_KEY);
  const ul = document.getElementById('employees-list');
  if (ul) {
    ul.innerHTML = '';
    list.forEach((item, index) => {
      const li = document.createElement('li');
      let text = `${item.date}: ${item.name} ${item.startTime}–${item.endTime}`;
      if (item.notes) {
        text += ` – ${item.notes}`;
      }
      li.textContent = text;
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.addEventListener('click', () => {
        deleteItem(EMPLOYEE_KEY, index);
        renderEmployeeSchedules();
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }
  refreshEmployeeCalendar();
}

// Form handler
const empForm = document.getElementById('employee-form');
if (empForm) {
  empForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const newItem = {
      name: document.getElementById('employee-name').value.trim(),
      date: document.getElementById('employee-date').value,
      startTime: document.getElementById('employee-start').value,
      endTime: document.getElementById('employee-end').value,
      notes: document.getElementById('employee-notes').value.trim()
    };
    // Validate times
    if (!newItem.date || !newItem.startTime || !newItem.endTime) {
      alert('Please provide a date, start time and end time.');
      return;
    }
    const start = new Date(`${newItem.date}T${newItem.startTime}`);
    const end = new Date(`${newItem.date}T${newItem.endTime}`);
    if (end <= start) {
      alert('End time must be after start time.');
      return;
    }
    // Check for overlapping shifts for the same employee
    const existing = getItems(EMPLOYEE_KEY);
    const overlap = existing.some(item => {
      if (item.name !== newItem.name || item.date !== newItem.date) return false;
      const s1 = new Date(`${item.date}T${item.startTime}`);
      const e1 = new Date(`${item.date}T${item.endTime}`);
      return (start < e1 && end > s1);
    });
    if (overlap) {
      alert('This shift overlaps with an existing shift for this employee.');
      return;
    }
    saveItem(EMPLOYEE_KEY, newItem);
    empForm.reset();
    renderEmployeeSchedules();
  });
}

// Initialise mini calendar for employee page
function initEmployeeMiniCalendar() {
  const miniEl = document.getElementById('employee-mini-calendar');
  if (!miniEl) return;
  employeeMiniCalendar = new FullCalendar.Calendar(miniEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: '',
      center: 'title',
      right: ''
    },
    events: [],
    selectable: true,
    height: 'auto',
    dateClick: function(info) {
      if (employeeCalendar) {
        employeeCalendar.gotoDate(info.date);
      }
    }
  });
  employeeMiniCalendar.render();
}

// Initialise calendar and render existing schedules
initEmployeeCalendar();
renderEmployeeSchedules();

// Initialise employee mini calendar
initEmployeeMiniCalendar();