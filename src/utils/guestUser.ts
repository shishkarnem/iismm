/**
 * Persistent Guest Identity for Unregistered Users
 * Generates and stores unique ID and user-friendly name in localStorage
 * Allows likes, comments, and replies without registration.
 */

export interface GuestUserInfo {
  id: string;
  name: string;
}

export function getOrCreateGuestUser(): GuestUserInfo {
  if (typeof window === 'undefined') {
    return { id: 'guest_server', name: 'Гость' };
  }

  try {
    let guestId = localStorage.getItem('iismm_guest_id');
    if (!guestId) {
      const randPart = Math.random().toString(36).substring(2, 8);
      const timePart = Date.now().toString(36);
      guestId = `guest_${timePart}_${randPart}`;
      localStorage.setItem('iismm_guest_id', guestId);
    }

    let guestName = localStorage.getItem('iismm_guest_name');
    if (!guestName || guestName.trim() === '') {
      const num = Math.floor(1000 + Math.random() * 9000);
      guestName = `Гость #${num}`;
      localStorage.setItem('iismm_guest_name', guestName);
    }

    return { id: guestId, name: guestName.trim() };
  } catch (e) {
    return { id: 'guest_' + Date.now(), name: 'Гость' };
  }
}

export function updateGuestUserName(newName: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = newName.trim();
  if (trimmed) {
    try {
      localStorage.setItem('iismm_guest_name', trimmed);
    } catch (e) {}
  }
}
