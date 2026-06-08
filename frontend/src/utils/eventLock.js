/** Completed events are read-only for non-admins. */
export function isEventLocked(eventData, user) {
  const status = eventData?.event?.status;
  return status === 'completed' && !user?.isAdmin;
}

export const EVENT_LOCKED_MESSAGE =
  'This event is completed. Only administrators can make changes.';
