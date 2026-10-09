// Next's internal URL can use the container port instead of the browser-facing
// port. Validate the actual Host authority, never an arbitrary forwarded host.
export function hasAllowedOrigin(request: Request): boolean {
  const value = request.headers.get('origin');
  if (!value) return true; // REST/MCP clients need not send Origin.
  try {
    const origin = new URL(value);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== value) return false;
    const host = request.headers.get('host');
    if (host) return origin.host === new URL(origin.protocol + '//' + host).host;
    return origin.origin === new URL(request.url).origin;
  } catch {return false;}
}
