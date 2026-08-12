export type MessageThreadDocument = {
  subject: string | null;
  timestamp: string;
  sender: string;
  recipient: string;
  htmlBody: string | null;
  replies: {
    id: number;
    timestamp: string;
    sender: string;
    htmlBody: string | null;
  }[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function messageReplyCountLabel(count: number): string {
  if (count === 0) return "Ei vastauksia";
  if (count === 1) return "1 vastaus";
  return `${count} vastausta`;
}

export function buildMessageThreadHtml(
  detail: MessageThreadDocument,
  isDark: boolean,
  fallbackSender = ""
): string {
  const colors = isDark
    ? { background: "#1e1e1e", card: "#292929", border: "#3b3b3b", text: "#f3f3f3", muted: "#aaaaaa", accent: "#51a2ff" }
    : { background: "#f5f7fb", card: "#ffffff", border: "#dfe5ee", text: "#202939", muted: "#667085", accent: "#4A89EE" };
  const emptyBody = '<p class="empty">Viestillä ei ole tekstisisältöä.</p>';
  const entries = [
    {
      id: 0,
      kind: "main",
      label: "Alkuperäinen viesti",
      sender: detail.sender || fallbackSender,
      timestamp: detail.timestamp,
      recipient: detail.recipient,
      htmlBody: detail.htmlBody,
    },
    ...detail.replies.map((reply, index) => ({
      ...reply,
      kind: "reply",
      label: `Vastaus ${index + 1}`,
      recipient: "",
    })),
  ];

  const thread = entries.map((entry) => {
    const sender = escapeHtml(entry.sender || "Tuntematon lähettäjä");
    const timestamp = escapeHtml(entry.timestamp);
    const recipient = escapeHtml(entry.recipient);
    return `<article class="entry ${entry.kind}" data-entry-id="${entry.id}">
      <header>
        <span class="entry-label">${entry.label}</span>
        <strong>${sender}</strong>
        ${timestamp ? `<time>${timestamp}</time>` : ""}
        ${recipient ? `<span class="recipient">Vastaanottaja: ${recipient}</span>` : ""}
      </header>
      <div class="entry-body">${entry.htmlBody ?? emptyBody}</div>
    </article>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px 14px 40px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: ${colors.text}; background: ${colors.background}; overflow-wrap: anywhere; }
    .thread { display: flex; flex-direction: column; gap: 14px; }
    .entry { padding: 16px; border: 1px solid ${colors.border}; border-radius: 14px; background: ${colors.card}; }
    .entry.main { border-left: 4px solid ${colors.accent}; }
    .entry.reply { margin-left: 12px; }
    header { display: flex; flex-direction: column; gap: 2px; padding-bottom: 11px; margin-bottom: 12px; border-bottom: 1px solid ${colors.border}; }
    .entry-label { color: ${colors.accent}; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    strong { font-size: 15px; color: ${colors.text}; }
    time, .recipient { color: ${colors.muted}; font-size: 12px; }
    .entry-body { color: ${colors.text}; }
    .entry-body > :first-child { margin-top: 0; }
    .entry-body > :last-child { margin-bottom: 0; }
    .empty { color: ${colors.muted}; font-style: italic; }
    a { color: ${colors.accent}; word-break: break-all; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    p { margin: 0 0 14px; }
    ul, ol { padding-left: 22px; margin: 0 0 14px; }
    li { margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    td, th { padding: 8px; border: 1px solid ${colors.border}; }
    blockquote { border-left: 3px solid ${colors.accent}; margin: 0 0 14px; padding: 4px 14px; color: ${colors.muted}; }
    hr { border: none; border-top: 1px solid ${colors.border}; margin: 16px 0; }
  </style>
</head>
<body><main class="thread">${thread}</main></body>
</html>`;
}
