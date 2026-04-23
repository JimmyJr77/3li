/** Plain text → single-paragraph HTML for persistence (no rich formatting). */
export function plainTextToStudioHtml(raw: string): string {
  const t = raw.trim();
  if (!t) return "<p></p>";
  const esc = t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  return `<p>${esc.replace(/\n/g, "<br/>")}</p>`;
}

export function stripHtmlToPlain(html: string): string {
  if (typeof window === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? "").replace(/\s+/g, " ").trim();
}
