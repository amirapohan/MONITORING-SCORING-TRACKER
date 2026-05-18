const multer = require("multer");
const { validationError } = require("../../core/api_error");

const maxProofFileSizeInBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxProofFileSizeInBytes,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(validationError("Only PDF, JPG, PNG, or WEBP proof files are allowed"));
      return;
    }

    callback(null, true);
  },
});

function handleSubmissionUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.single("file")(req, res, (error) => {
      if (!error) {
        resolve();
        return;
      }

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          reject(validationError("File size exceeds the maximum limit of 10 MB"));
          return;
        }

        reject(validationError(error.message));
        return;
      }

      reject(error);
    });
  });
}

module.exports = {
  handleSubmissionUpload,
  maxProofFileSizeInBytes,
};
