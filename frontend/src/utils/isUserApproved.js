/**
 * Users without `approvalStatus` (legacy documents) are treated as approved.
 */
export function isUserApproved(user) {
  if (!user) return false;
  const status = user.approvalStatus;
  if (status === undefined || status === null) return true;
  return status === 'approved';
}
