/*
 * Page-specific logic for managing boat/trailer moves.  This script
 * handles adding new moves to localStorage and rendering the list
 * of existing moves.  Each move includes a date, time, description
 * and boat/trailer details.
 */

// Ensure the user is authenticated before allowing interaction
ensureLoggedIn();

const SCHEDULE_KEY = 'schedules';

// Define appointment categories and their colours
const APPOINTMENT_TYPES = [
  { name: 'Launch', color: '#007F7E' },
  { name: 'Water Haul In', color: '#4577D5' },
  { name: 'Winter Storage Removal', color: '#C11A44' },
  { name: 'Winter Storage Intake', color: '#EBCB00' },
  { name: 'Trailer Storage Removal', color: '#8F4E9F' },
  { name: 'Trailer Storage Intake', color: '#F58220' },
  { name: 'Other', color: '#7A7A7A' }
];

// Map for quick colour lookup
const TYPE_COLOURS = {};
APPOINTMENT_TYPES.forEach(item => {
  TYPE_COLOURS[item.name] = item.color;
});

// Keep track of which appointment types are currently visible
const selectedCategories = new Set(APPOINTMENT_TYPES.map(item => item.name));

// FullCalendar instance for this page
let scheduleCalendar;

// Mini calendar instance
window.miniCalendar = null;

/**
 * Convert stored schedule items into FullCalendar event objects.  Each
 * event includes start and end times, a coloured background based on
 * appointment type, and the full record in extendedProps for later use.
 */
function transformSchedulesToEvents() {
  const list = getItems(SCHEDULE_KEY);
  return list.map((item, index) => ({
    title: item.description,
    start: `${item.startDate}T${item.startTime}`,
    end: `${item.endDate}T${item.endTime}`,
    backgroundColor: TYPE_COLOURS[item.appointmentType] || TYPE_COLOURS['Other'],
    borderColor: TYPE_COLOURS[item.appointmentType] || TYPE_COLOURS['Other'],
    extendedProps: {
      record: item,
      appointmentType: item.appointmentType,
      index: index
    }
  }));
}

/**
 * Initialise the FullCalendar instance and render it into the
 * element with id "calendar".  This should only be called once.
 */
function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  scheduleCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    height: 'auto',
    events: transformSchedulesToEvents(),
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    slotDuration: '00:30:00',
    slotMinTime: '07:00:00',
    slotMaxTime: '16:00:00',
    allDaySlot: false,
    businessHours: {
      daysOfWeek: [1, 2, 3, 4, 5, 6], // Monday through Saturday
      startTime: '07:00',
      endTime: '16:00'
    },
    eventOverlap: false,
    selectable: true,
    selectOverlap: false,
    editable: false,
    // Determine if a selection is allowed (no Sundays)
    selectAllow: function(selectInfo) {
      // Start day 0 = Sunday, 6 = Saturday
      return selectInfo.start.getDay() !== 0;
    },
    // Keep mini calendar in sync when main calendar dates change
    datesSet: function (info) {
      if (window.miniCalendar) {
        window.miniCalendar.gotoDate(info.start);
      }
    },
    eventDidMount: function (info) {
      const type = info.event.extendedProps.appointmentType;
      if (!selectedCategories.has(type)) {
        info.event.setProp('display', 'none');
      }
    },
    select: function(info) {
      // Called when the user selects a timeslot. We'll open the modal for a new appointment.
      openAppointmentModal('add', { start: info.start, end: info.end });
      scheduleCalendar.unselect();
    },
    eventClick: function(info) {
      // Called when an event is clicked. We'll open the modal for editing the appointment.
      openAppointmentModal('edit', { event: info.event });
    }
  });
  scheduleCalendar.render();
}

/**
 * Refresh the events displayed on the calendar.  Called after
 * adding or removing schedule items.
 */
function refreshCalendar() {
  if (scheduleCalendar) {
    const events = transformSchedulesToEvents();
    scheduleCalendar.removeAllEvents();
    events.forEach(ev => {
      const eventObj = scheduleCalendar.addEvent(ev);
      // Hide if not selected
      if (!selectedCategories.has(ev.extendedProps.appointmentType)) {
        eventObj.setProp('display', 'none');
      }
    });
  }
}

/**
 * Render the list of scheduled moves from localStorage.  Also
 * refreshes the calendar events once complete.
 */
function renderSchedules() {
  const list = getItems(SCHEDULE_KEY);
  const ul = document.getElementById('schedule-list');
  if (ul) {
    ul.innerHTML = '';
    list.forEach((item, index) => {
      const li = document.createElement('li');
      // Format list entry
      const text = `${item.startDate} ${item.startTime}–${item.endDate} ${item.endTime}: ${item.description} (${item.appointmentType}) for ${item.name}`;
      li.textContent = text;
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.addEventListener('click', () => {
        deleteItem(SCHEDULE_KEY, index);
        renderSchedules();
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }
  refreshCalendar();
}

// Modal management
let currentModalMode = null; // 'add' or 'edit'
let currentEventIndex = null; // index of record being edited, null when adding

// Populate appointment type select in modal
function populateModalAppointmentOptions() {
  const select = document.getElementById('modal-type');
  if (!select) return;
  select.innerHTML = '';
  APPOINTMENT_TYPES.forEach(item => {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = item.name;
    select.appendChild(option);
  });
}

// Open modal for new or edit
function openAppointmentModal(mode, data) {
  currentModalMode = mode;
  const modal = document.getElementById('appointment-modal');
  const modalTitle = document.getElementById('modal-title');
  const startInput = document.getElementById('modal-start');
  const descInput = document.getElementById('modal-desc');
  const nameInput = document.getElementById('modal-name');
  const typeSelect = document.getElementById('modal-type');
  const deleteBtn = document.getElementById('modal-delete');
  populateModalAppointmentOptions();
  if (mode === 'add') {
    modalTitle.textContent = 'New Appointment';
    // data.start is a Date object representing the beginning of the slot
    const startDateTime = data.start;
    // Format as readable string
    startInput.value = formatDateTimeForDisplay(startDateTime);
    // store start date/time for saving later in hidden dataset
    startInput.dataset.iso = startDateTime.toISOString();
    descInput.value = '';
    nameInput.value = '';
    typeSelect.value = APPOINTMENT_TYPES[0].name;
    deleteBtn.style.display = 'none';
    currentEventIndex = null;
  } else if (mode === 'edit' && data.event) {
    modalTitle.textContent = 'Edit Appointment';
    const rec = data.event.extendedProps.record;
    // Compose a Date from stored startDate and startTime
    const startDT = new Date(`${rec.startDate}T${rec.startTime}`);
    startInput.value = formatDateTimeForDisplay(startDT);
    startInput.dataset.iso = startDT.toISOString();
    descInput.value = rec.description;
    nameInput.value = rec.name;
    typeSelect.value = rec.appointmentType;
    deleteBtn.style.display = 'inline-block';
    currentEventIndex = data.event.extendedProps.index;
  }
  modal.style.display = 'flex';
}

// Close modal and reset state
function closeAppointmentModal() {
  const modal = document.getElementById('appointment-modal');
  modal.style.display = 'none';
  currentModalMode = null;
  currentEventIndex = null;
}

// Format date/time to human readable string (e.g., Wed Aug 20, 2025 10:00 AM)
function formatDateTimeForDisplay(dateObj) {
  return dateObj.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Save appointment (add or edit) from modal
function handleModalSave(e) {
  e.preventDefault();
  const startInput = document.getElementById('modal-start');
  const descInput = document.getElementById('modal-desc');
  const nameInput = document.getElementById('modal-name');
  const typeSelect = document.getElementById('modal-type');
  const startISO = startInput.dataset.iso;
  const startDateObj = new Date(startISO);
  // compute start date/time in local timezone
  const startYear = startDateObj.getFullYear();
  const startMonth = String(startDateObj.getMonth() + 1).padStart(2, '0');
  const startDay = String(startDateObj.getDate()).padStart(2, '0');
  const startHours = String(startDateObj.getHours()).padStart(2, '0');
  const startMinutes = String(startDateObj.getMinutes()).padStart(2, '0');
  const startDate = `${startYear}-${startMonth}-${startDay}`;
  const startTime = `${startHours}:${startMinutes}`;
  // compute end time as start + 30 minutes in local timezone
  const endDateObj = new Date(startDateObj.getTime() + 30 * 60000);
  const endYear = endDateObj.getFullYear();
  const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDateObj.getDate()).padStart(2, '0');
  const endHours = String(endDateObj.getHours()).padStart(2, '0');
  const endMinutes = String(endDateObj.getMinutes()).padStart(2, '0');
  const endDate = `${endYear}-${endMonth}-${endDay}`;
  const endTime = `${endHours}:${endMinutes}`;
  const record = {
    startDate: startDate,
    startTime: startTime,
    endDate: endDate,
    endTime: endTime,
    description: descInput.value.trim(),
    name: nameInput.value.trim(),
    appointmentType: typeSelect.value
  };
  // basic validation
  if (!record.description || !record.name) {
    alert('Please provide a description and name.');
    return;
  }
  // Validate time is within allowed range (start between 7:00 and 15:30) and not on Sunday
  const hour = startDateObj.getHours();
  const minute = startDateObj.getMinutes();
  if (
    startDateObj.getDay() === 0 ||
    hour < 7 ||
    hour > 15 ||
    (hour === 15 && minute > 30)
  ) {
    alert('Invalid start time or day for scheduling.');
    return;
  }
  // Check overlap with existing events
  const existing = getItems(SCHEDULE_KEY);
  const newStart = startDateObj;
  const newEnd = endDateObj;
  const overlap = existing.some((item, idx) => {
    if (currentModalMode === 'edit' && idx === currentEventIndex) return false;
    const s1 = new Date(`${item.startDate}T${item.startTime}`);
    const e1 = new Date(`${item.endDate}T${item.endTime}`);
    return newStart < e1 && newEnd > s1;
  });
  if (overlap) {
    alert('This appointment overlaps with an existing one.');
    return;
  }
  if (currentModalMode === 'add') {
    saveItem(SCHEDULE_KEY, record);
  } else if (currentModalMode === 'edit' && currentEventIndex !== null) {
    // Update existing record
    const list = getItems(SCHEDULE_KEY);
    list[currentEventIndex] = record;
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(list));
  }
  closeAppointmentModal();
  renderSchedules();
}

// Handle deletion from modal
function handleModalDelete() {
  if (currentModalMode === 'edit' && currentEventIndex !== null) {
    deleteItem(SCHEDULE_KEY, currentEventIndex);
    closeAppointmentModal();
    renderSchedules();
  }
}

// Bind modal buttons
document.addEventListener('DOMContentLoaded', () => {
  const modalForm = document.getElementById('modal-form');
  if (modalForm) {
    modalForm.addEventListener('submit', handleModalSave);
  }
  const cancelBtn = document.getElementById('modal-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeAppointmentModal);
  }
  const deleteBtn = document.getElementById('modal-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', handleModalDelete);
  }
});

// Initialise the calendar and render existing schedules on load
initCalendar();
renderSchedules();

// Initialise mini calendar for date navigation
function initMiniCalendar() {
  const miniEl = document.getElementById('mini-calendar');
  if (!miniEl) return;
  window.miniCalendar = new FullCalendar.Calendar(miniEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: '',
      center: 'title',
      right: ''
    },
    events: [],
    selectable: true,
    height: 'auto',
    dateClick: function (info) {
      if (scheduleCalendar) {
        scheduleCalendar.gotoDate(info.date);
      }
    }
  });
  window.miniCalendar.render();
}

// Render the legend of appointment types with checkboxes for filtering
function renderLegend() {
  const legendEl = document.getElementById('legend');
  if (!legendEl) return;
  legendEl.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'Appointment Types';
  legendEl.appendChild(title);
  APPOINTMENT_TYPES.forEach(item => {
    const wrap = document.createElement('div');
    wrap.className = 'legend-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.type = item.name;
    checkbox.addEventListener('change', (e) => {
      const type = e.target.dataset.type;
      if (e.target.checked) {
        selectedCategories.add(type);
      } else {
        selectedCategories.delete(type);
      }
      refreshCalendarDisplay();
    });
    const colourBox = document.createElement('span');
    colourBox.className = 'legend-color';
    colourBox.style.backgroundColor = item.color;
    const label = document.createElement('span');
    label.textContent = item.name;
    wrap.appendChild(checkbox);
    wrap.appendChild(colourBox);
    wrap.appendChild(label);
    legendEl.appendChild(wrap);
  });
}

// Refresh event visibility according to selected categories
function refreshCalendarDisplay() {
  if (!scheduleCalendar) return;
  scheduleCalendar.getEvents().forEach(ev => {
    const type = ev.extendedProps.appointmentType;
    if (selectedCategories.has(type)) {
      ev.setProp('display', 'auto');
    } else {
      ev.setProp('display', 'none');
    }
  });
}

// There is no static appointment form now, so no need to populate select at load.

// Initialise mini calendar and legend on load
initMiniCalendar();
renderLegend();
