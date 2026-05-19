import type { SafeUser } from "../types/auth";

export const stripPassword = (user: {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  role: string;
  isActive: boolean;
  skills?: SafeUser["skills"];
  subSkills?: SafeUser["subSkills"];
  createdAt: Date;
  updatedAt: Date;
}): SafeUser => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  skills: user.skills ?? [],
  subSkills: user.subSkills ?? [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
