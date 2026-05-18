import { OAuth2Client } from "google-auth-library";

import { config } from "../config";

const googleClient = new OAuth2Client(config.google.clientId || undefined);

export type VerifiedGoogleUser = {
  subject: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export const verifyGoogleIdToken = async (idToken: string): Promise<VerifiedGoogleUser> => {
  if (!config.google.clientId) {
    throw new Error("Missing required environment variable: GOOGLE_CLIENT_ID");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new Error("Google token payload is missing required fields");
  }

  return {
    subject: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email.split("@")[0],
    emailVerified: payload.email_verified ?? false,
  };
};
