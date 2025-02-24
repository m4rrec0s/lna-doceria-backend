import { Request, Response } from "express";
import { prisma } from "../utils/prismaClient";
import bcrypt from "bcrypt";

export const registerController = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: "Missing required information" });
    return;
  }

  const emailExists = await prisma.user.findUnique({ where: { email } });

  if (emailExists) {
    res.status(400).json({
      message: "email already exists.",
    });
    return;
  }

  const hashPassword = await bcrypt.hash(String(password), 8);

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashPassword,
    },
  });

  res.status(201).json(newUser);
};

export const updateUserController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { name, email, password } = req.body;
  const { id } = req.params;

  if (!name && !email && !password) {
    res.status(400).json({ message: "Missing required information" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const hashPassword = password
    ? await bcrypt.hash(String(password), 8)
    : user.password;

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      name: name || user.name,
      email: email || user.email,
      password: hashPassword,
    },
  });

  res.status(200).json(updatedUser);
};
