const fs = require("fs/promises");
const path = require("path");

const templatePath = path.join(__dirname, "..", "templates", "certificate.html");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCompletionDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function renderCertificateHtml({ talentName, projectTitle, completedAt, issuerName }) {
  const template = await fs.readFile(templatePath, "utf8");

  return template
    .replaceAll("{{talentName}}", escapeHtml(talentName))
    .replaceAll("{{projectTitle}}", escapeHtml(projectTitle))
    .replaceAll("{{issuerName}}", escapeHtml(issuerName || "Kelompok 4 Tracker Service"))
    .replaceAll("{{completedAt}}", escapeHtml(formatCompletionDate(completedAt)));
}

module.exports = {
  renderCertificateHtml,
};
