import { Request, Response } from "express";
import { prisma } from "../utils/prismaClient";

export const createFlavor = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, imageUrl, categoryId } = req.body;

    if (!name) {
      res.status(400).json({ error: "Nome do sabor é obrigatório" });
      return;
    }

    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        res.status(404).json({ error: "Categoria não encontrada" });
        return;
      }
    }

    const flavor = await prisma.flavor.create({
      data: {
        name,
        imageUrl,
        categoryId,
      },
    });

    res.status(201).json(flavor);
  } catch (error) {
    console.error("Erro ao criar sabor:", error);
    res.status(500).json({ error: "Erro interno ao criar sabor" });
  }
};

export const getFlavors = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryId } = req.query;

    const where = categoryId ? { categoryId: categoryId as string } : {};

    const flavors = await prisma.flavor.findMany({
      where,
      include: { category: true },
    });

    res.json(flavors);
  } catch (error) {
    console.error("Erro ao buscar sabores:", error);
    res.status(500).json({ error: "Erro ao buscar sabores" });
  }
};

export const getFlavorById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const flavor = await prisma.flavor.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!flavor) {
      res.status(404).json({ error: "Sabor não encontrado" });
      return;
    }

    res.json(flavor);
  } catch (error) {
    console.error("Erro ao buscar sabor:", error);
    res.status(500).json({ error: "Erro ao buscar sabor" });
  }
};

export const updateFlavor = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, imageUrl, categoryId } = req.body;

    const flavor = await prisma.flavor.findUnique({ where: { id } });

    if (!flavor) {
      res.status(404).json({ error: "Sabor não encontrado" });
      return;
    }

    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        res.status(404).json({ error: "Categoria não encontrada" });
        return;
      }
    }

    const updatedFlavor = await prisma.flavor.update({
      where: { id },
      data: {
        name: name || flavor.name,
        imageUrl: imageUrl !== undefined ? imageUrl : flavor.imageUrl,
        categoryId: categoryId !== undefined ? categoryId : flavor.categoryId,
      },
      include: { category: true },
    });

    res.json(updatedFlavor);
  } catch (error) {
    console.error("Erro ao atualizar sabor:", error);
    res.status(500).json({ error: "Erro ao atualizar sabor" });
  }
};

export const deleteFlavor = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const flavor = await prisma.flavor.findUnique({ where: { id } });

    if (!flavor) {
      res.status(404).json({ error: "Sabor não encontrado" });
      return;
    }

    await prisma.flavor.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir sabor:", error);
    res.status(500).json({ error: "Erro ao excluir sabor" });
  }
};

export const getFlavorsByCategoryId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryId } = req.params;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { flavors: true },
    });

    if (!category) {
      res.status(404).json({ error: "Categoria não encontrada" });
      return;
    }

    res.json(category.flavors);
  } catch (error) {
    console.error("Erro ao buscar sabores por categoria:", error);
    res.status(500).json({ error: "Erro ao buscar sabores por categoria" });
  }
};
