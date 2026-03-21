export const SIMPLE_ADMIN_PASSWORD = "0610";

const ADMIN_AUTH_STORAGE_KEY = "wedding-rsvp-admin-auth";
const ADMIN_AUTH_LOGGED_IN_VALUE = "logged-in";

export function isAdminLoggedIn() {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === ADMIN_AUTH_LOGGED_IN_VALUE;
}

export function setAdminLoggedIn() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, ADMIN_AUTH_LOGGED_IN_VALUE);
}

export function clearAdminLoggedIn() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
}
