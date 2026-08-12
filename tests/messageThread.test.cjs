const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildMessageThreadHtml,
  messageReplyCountLabel,
} = require("../.expo/message-thread-test-build/messageThread.js");

const detail = {
  subject: "Keskustelu",
  timestamp: "12.8.2026 09:00",
  sender: "Opettaja Olli",
  recipient: "Oppilas Oona",
  htmlBody: "<p>Ensimmäinen viesti</p>",
  replies: [
    { id: 2, timestamp: "12.8.2026 09:05", sender: "Oppilas Oona", htmlBody: "<p>Ensimmäinen vastaus</p>" },
    { id: 3, timestamp: "12.8.2026 09:10", sender: "Opettaja Olli", htmlBody: "<p>Toinen vastaus</p>" },
  ],
};

test("renders the original message and every reply in order", () => {
  const html = buildMessageThreadHtml(detail, false);
  const first = html.indexOf("Ensimmäinen viesti");
  const second = html.indexOf("Ensimmäinen vastaus");
  const third = html.indexOf("Toinen vastaus");
  assert.ok(first >= 0 && first < second && second < third);
  assert.match(html, /Vastaus 1/);
  assert.match(html, /Vastaus 2/);
});

test("escapes thread metadata while preserving Wilma message HTML", () => {
  const html = buildMessageThreadHtml({ ...detail, sender: '<script>alert("x")</script>' }, true);
  assert.ok(!html.includes('<script>alert("x")</script>'));
  assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"));
  assert.ok(html.includes("<p>Ensimmäinen viesti</p>"));
});

test("uses Finnish reply count labels", () => {
  assert.equal(messageReplyCountLabel(0), "Ei vastauksia");
  assert.equal(messageReplyCountLabel(1), "1 vastaus");
  assert.equal(messageReplyCountLabel(3), "3 vastausta");
});
