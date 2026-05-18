export type JwtPayload = {
  id: string;
  email: string;
  role: "talent" | "client" | "admin";
  jti: string;
};

export type RefreshTokenPayload = {
  id: string;
};

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AppRole = JwtPayload["role"];

export type RequestContext = {
  ip?: string;
  userAgent?: string;
};
