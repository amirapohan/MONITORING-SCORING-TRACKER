const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { configurationError } = require("../core/api_error");

const execFileAsync = promisify(execFile);

function getWeasyPrintBinary() {
  return process.env.WEASYPRINT_BIN || "weasyprint";
}

async function renderPdfFromHtml({ html, fileNamePrefix }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `${fileNamePrefix}-`));
  const htmlPath = path.join(tempDir, `${fileNamePrefix}.html`);
  const pdfPath = path.join(tempDir, `${fileNamePrefix}.pdf`);

  try {
    await fs.writeFile(htmlPath, html, "utf8");

    await execFileAsync(getWeasyPrintBinary(), [htmlPath, pdfPath]);

    const pdfBuffer = await fs.readFile(pdfPath);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw configurationError("Generated certificate PDF is empty");
    }

    return {
      pdfBuffer,
      pdfPath,
      htmlPath,
    };
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    throw configurationError(
      `Failed to generate certificate PDF with WeasyPrint: ${error.message}`,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  renderPdfFromHtml,
};
