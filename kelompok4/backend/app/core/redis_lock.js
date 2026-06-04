const crypto = require("crypto");
const { client } = require("./redis");

const LOCK_RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

async function acquireLock(key, ttlSeconds = 30) {
  const token = crypto.randomUUID();
  const result = await client.set(key, token, "EX", ttlSeconds, "NX");

  if (result !== "OK") {
    return null;
  }

  return {
    key,
    token,
  };
}

async function releaseLock(lock) {
  if (!lock) {
    return;
  }

  await client.eval(LOCK_RELEASE_SCRIPT, 1, lock.key, lock.token);
}

module.exports = {
  acquireLock,
  releaseLock,
};
