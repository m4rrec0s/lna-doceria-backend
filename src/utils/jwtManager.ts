import jwt from "jsonwebtoken";

type JwtPayload = {
  id: string;
};

const SECRET_KEY = process.env.JWT_SECRET || process.env.JWT;

export function createToken(payload: JwtPayload) {
  if (!SECRET_KEY) {
    throw new Error("JWT_SECRET/JWT não configurado");
  }
  return jwt.sign(payload, SECRET_KEY, { expiresIn: "1h" });
}

export function verifyToken(token: string): JwtPayload {
  if (!SECRET_KEY) {
    throw new Error("JWT_SECRET/JWT não configurado");
  }
  return jwt.verify(token, SECRET_KEY) as JwtPayload;
}
