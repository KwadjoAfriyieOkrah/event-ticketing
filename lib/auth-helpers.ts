export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string, details?: unknown) {
  return Response.json({ error: message, details }, { status: 400 });
}
