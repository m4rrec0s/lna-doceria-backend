import { prisma } from "../utils/prismaClient";
import { Request, Response } from "express";

export const createCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, sellingType, packageSizes } = req.body;

    if (!name) {
      res.status(400).json({ error: "Nome da categoria é obrigatório" });
      return;
    }

    if (sellingType && !["unit", "package"].includes(sellingType)) {
      res.status(400).json({
        error: "Tipo de venda inválido. Use 'unit' ou 'package'",
      });
      return;
    }

    let packageSizesString = null;
    if (packageSizes) {
      if (Array.isArray(packageSizes)) {
        packageSizesString = JSON.stringify(packageSizes);
      } else {
        try {
          const parsedSizes = JSON.parse(packageSizes);
          if (!Array.isArray(parsedSizes)) {
            throw new Error("packageSizes deve ser um array");
          }
          packageSizesString = packageSizes;
        } catch (error) {
          res.status(400).json({
            error:
              "O formato de packageSizes é inválido. Deve ser um array JSON",
          });
          return;
        }
      }
    }

    const category = await prisma.category.create({
      data: {
        name,
        sellingType: sellingType || "unit",
        packageSizes: packageSizesString,
      },
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
    const categories = await prisma.category.findMany();

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
    const { name, sellingType, packageSizes } = req.body;

    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      res.status(404).json({ error: "Categoria não encontrada" });
      return;
    }

    if (sellingType && !["unit", "package"].includes(sellingType)) {
      res.status(400).json({
        error: "Tipo de venda inválido. Use 'unit' ou 'package'",
      });
      return;
    }

    let packageSizesString = category.packageSizes;
    if (packageSizes !== undefined) {
      if (packageSizes === null) {
        packageSizesString = null;
      } else if (Array.isArray(packageSizes)) {
        packageSizesString = JSON.stringify(packageSizes);
      } else {
        try {
          const parsedSizes = JSON.parse(packageSizes);
          if (!Array.isArray(parsedSizes)) {
            throw new Error("packageSizes deve ser um array");
          }
          packageSizesString = packageSizes;
        } catch (error) {
          res.status(400).json({
            error:
              "O formato de packageSizes é inválido. Deve ser um array JSON",
          });
          return;
        }
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        name: name || category.name,
        sellingType: sellingType || category.sellingType,
        packageSizes: packageSizesString,
      },
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

    const category = await prisma.category.findUnique({ where: { id } });

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
