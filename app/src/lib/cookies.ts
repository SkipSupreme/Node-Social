// Safe cookie getter for web; returns null on native
export const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  // Escape special regex characters in cookie name
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};
