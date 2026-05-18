export const parseExpiresToMs = (expiresIn: string) => {
  const unit = expiresIn.slice(-1);
  const value = Number.parseInt(expiresIn.slice(0, -1), 10);
  const map: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (map[unit] ?? 1000);
};
