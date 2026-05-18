const { PrismaClient } = require("@prisma/client");

// Satu instance PrismaClient dipakai bersama seluruh aplikasi.
// PrismaClient connect secara lazy saat query pertama dijalankan.
const prisma = new PrismaClient();

module.exports = prisma;
