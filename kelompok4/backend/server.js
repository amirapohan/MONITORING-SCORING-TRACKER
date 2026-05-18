const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./app/core/swagger");
const apiRoutes = require("./app/presentation/routes");

const app = express();
// Default 8080 supaya cocok dengan gateway & compose integrasi (nexus).
// Bisa dioverride lewat env PORT (mis. untuk kebutuhan lokal).
const port = process.env.PORT || 8080;
const HOST = "0.0.0.0"; //biar bisa diakses dari docker

// Middleware untuk parsing JSON
app.use(express.json());

// Setup endpoint untuk Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Daftarkan routes aplikasi
app.use("/api/v1", apiRoutes);

app.listen(port, HOST, () => {
  console.log(`🚀 Server berjalan di http://${HOST}:${port}`);
  console.log(
    `📚 Dokumentasi Swagger tersedia di http://${HOST}:${port}/api-docs`,
  );
});
