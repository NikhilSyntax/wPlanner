const TYPE_LABELS = {
  service: 'Worship Service',
  rehearsal: 'Rehearsal',
  meeting: 'Team Meeting',
  special: 'Special Event',
  seminar: 'Seminar',
  wedding: 'Wedding',
  baptism: 'Baptism',
  other: 'Event',
};

export function getEventDisplayTitle(eventData) {
  if (!eventData) return '';

  const stored = eventData.event?.title?.trim();
  if (stored) return stored;

  const type = eventData.event?.type || 'service';
  const label = TYPE_LABELS[type] || 'Event';
  const start = eventData.schedule?.start;

  if (start) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${label} — ${dateStr}`;
    }
  }

  return label;
}
