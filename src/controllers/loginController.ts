import bcrypt from "bcrypt";
import { createToken } from "../utils/jwtManager";
import { prisma } from "../utils/prismaClient";

export default async function loginController(req: any, res: any) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required.",
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(403).json({
      message: "invalid email or password.",
    });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    return res.status(403).json({
      message: "invalid email or password.",
    });
  }

  const token = createToken({ id: user.id });

  const loggedUser = {
    token,
    user,
  };

  return res.status(200).json(loggedUser);
}
