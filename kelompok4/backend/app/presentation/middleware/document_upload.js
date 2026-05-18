const multer = require("multer");
const { validationError } = require("../../core/api_error");

const maxFileSizeInBytes = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeInBytes,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      callback(validationError("Only PDF files are allowed"));
      return;
    }

    callback(null, true);
  },
});

function handleDocumentUpload(req, res) {
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
  handleDocumentUpload,
  maxFileSizeInBytes,
};
