import type { NextFunction, Request, Response } from "express";

import type { JwtPayload } from "../types/auth";

const authorize = (allowedRoles: JwtPayload["role"][]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Authentication required before authorization",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to access this resource",
      });
    }

    next();
  };
};

export default authorize;
