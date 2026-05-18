const yaml = require("yamljs");
const path = require("path");

// Load file swagger.yaml dari folder yang sama
const swaggerSpec = yaml.load(path.join(__dirname, "swagger.yaml"));

module.exports = swaggerSpec;
