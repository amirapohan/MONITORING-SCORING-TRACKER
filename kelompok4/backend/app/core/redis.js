const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// lazyConnect: jangan langsung error saat startup kalau Redis belum siap.
// maxRetriesPerRequest: 1 supaya perintah tidak menggantung lama saat Redis mati.
const client = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

let isReady = false;

client.on("ready", () => {
  isReady = true;
  console.log("[redis] connected:", REDIS_URL);
});

client.on("end", () => {
  isReady = false;
});

// Tanpa handler ini, error koneksi akan meng-crash proses (unhandled error event).
client.on("error", (err) => {
  isReady = false;
  console.warn("[redis] unavailable, fallback ke data repo:", err.message);
});

// Coba connect sekali di awal; kalau gagal, app tetap jalan tanpa cache.
client.connect().catch(() => {});

/**
 * Ambil & parse JSON dari cache. Mengembalikan null jika miss / Redis mati.
 * Tidak pernah melempar error agar tidak mengganggu alur utama.
 */
async function getJson(key) {
  if (!isReady) return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn(`[redis] getJson(${key}) gagal:`, err.message);
    return null;
  }
}

/**
 * Simpan value sebagai JSON dengan TTL (detik). Sengaja "fire-safe":
 * kegagalan cache tidak boleh menggagalkan request.
 */
async function setJson(key, value, ttlSeconds = 60) {
  if (!isReady) return;
  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.warn(`[redis] setJson(${key}) gagal:`, err.message);
  }
}

/** Hapus satu / banyak key (untuk invalidasi cache). */
async function del(...keys) {
  if (!isReady || keys.length === 0) return;
  try {
    await client.del(...keys);
  } catch (err) {
    console.warn(`[redis] del(${keys.join(",")}) gagal:`, err.message);
  }
}

module.exports = { client, getJson, setJson, del };
