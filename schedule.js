// schedule.js

document.addEventListener('DOMContentLoaded', function () {
  var calendarEl = document.getElementById('calendar');

  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    slotMinTime: '07:00:00',
    slotMaxTime: '16:00:00',
    allDaySlot: false,
    hiddenDays: [0], // Hide Sundays
    slotDuration: '00:30:00',
    snapDuration: '00:30:00',
    nowIndicator: true,
    selectable: true,
    selectMirror: true,
    editable: true,
    eventOverlap: false,

    // Force day/date stacked consistently
    dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric' },
    dayHeaderContent: (arg) => {
      const dow = arg.date.toLocaleDateString(undefined, { weekday: 'short' });
      const md  = arg.date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
      return { html: `<span class="nm-dow">${dow}</span><span class="nm-date">${md}</span>` };
    },

    headerToolbar: {
      left: '',
      center: 'title',
      right: 'prev,next today'
    },

    events: [],

    select: function (info) {
      const title = prompt('Enter Appointment Description:');
      if (title) {
        calendar.addEvent({
          title: title,
          start: info.start,
          end: info.end,
          allDay: false
        });
      }
      calendar.unselect();
    },

    eventClick: function (info) {
      alert('Appointment: ' + info.event.title);
    }
  });

  calendar.render();
});
