import { prisma } from "../utils/prismaClient";
import { Request, Response } from "express";

export const createCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: "Nome da categoria é obrigatório" });
      return;
    }

    const category = await prisma.category.create({
      data: {
        name,
      },
      include: { flavors: true },
    });

    const formattedCategory = {
      ...category,
      packageSizes: category.packageSizes
        ? JSON.parse(category.packageSizes)
        : null,
    };

    res.status(201).json(formattedCategory);
  } catch (error) {
    console.error("Erro ao criar categoria:", error);
    res.status(500).json({ error: "Erro interno ao criar categoria" });
  }
};

export const getCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      include: { flavors: true },
      orderBy: { name: "asc" },
    });

    const formattedCategories = categories.map((category) => ({
      ...category,
      packageSizes: category.packageSizes
        ? JSON.parse(category.packageSizes)
        : null,
    }));

    res.json(formattedCategories);
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    res.status(500).json({ error: "Erro ao buscar categorias" });
  }
};

export const updateCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      res.status(404).json({ error: "Categoria não encontrada" });
      return;
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name: name || category.name,
      },
      include: { flavors: true },
    });

    const formattedCategory = {
      ...updatedCategory,
      packageSizes: updatedCategory.packageSizes
        ? JSON.parse(updatedCategory.packageSizes)
        : null,
    };

    res.json(formattedCategory);
  } catch (error) {
    console.error("Erro ao atualizar categoria:", error);
    res.status(500).json({ error: "Erro ao atualizar categoria" });
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  try {
    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir categoria:", error);
    res.status(500).json({ error: "Erro ao excluir categoria" });
  }
};

export const getCategoryById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: { flavors: true },
    });

    if (!category) {
      res.status(404).json({ error: "Categoria não encontrada" });
      return;
    }

    const formattedCategory = {
      ...category,
      packageSizes: category.packageSizes
        ? JSON.parse(category.packageSizes)
        : null,
    };

    res.json(formattedCategory);
  } catch (error) {
    console.error("Erro ao buscar categoria:", error);
    res.status(500).json({ error: "Erro ao buscar categoria" });
  }
};
