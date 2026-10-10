/** Same rule as the backend (domain::board::is_web_link): absolute http(s) with a host. */
export function isWebLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}
