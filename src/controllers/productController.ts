import { Request, Response } from "express";
import { prisma } from "../utils/prismaClient";
import { deleteFromDrive, uploadToDrive } from "../config/googleDriveConfig";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, description, price, categoryIds, discount, imageUrl } =
      req.body;

    if (!name || !description || !price || !imageUrl) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    let parsedCategoryIds: string[] = [];
    if (categoryIds) {
      if (Array.isArray(categoryIds)) {
        parsedCategoryIds = categoryIds; // Caso já seja um array
      } else {
        try {
          parsedCategoryIds = JSON.parse(categoryIds);
          if (!Array.isArray(parsedCategoryIds)) {
            throw new Error("Não é um array");
          }
        } catch {
          // Se não for JSON válido, trata como string simples
          parsedCategoryIds = [categoryIds];
        }
      }
    }

    if (parsedCategoryIds.length > 0) {
      const existingCategories = await prisma.category.findMany({
        where: { id: { in: parsedCategoryIds } },
      });
      if (existingCategories.length !== parsedCategoryIds.length) {
        return res
          .status(400)
          .json({ error: "Uma ou mais categorias não existem" });
      }
    }

    const discountValue = discount ? parseFloat(discount) : null;
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        discount: discountValue,
        categories: parsedCategoryIds.length
          ? { connect: parsedCategoryIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: { categories: true }, // Retorna as categorias associadas
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({
      error: "Erro interno ao criar produto",
      details: (error as Error).message,
    });
  }
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const per_page = req.query.per_page
      ? parseInt(req.query.per_page as string)
      : 50;
    const skip = (page - 1) * per_page;

    // Abordagem ultra simplificada sem filtros complexos
    const totalCount = await prisma.product.count();

    const products = await prisma.product.findMany({
      include: { categories: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: per_page,
    });

    res.json({
      data: products,
      pagination: {
        total: totalCount,
        page: page,
        per_page: per_page,
        total_pages: Math.ceil(totalCount / per_page),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({
      error: "Erro interno ao buscar produtos",
      details:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const oldProduct = await prisma.product.findUnique({ where: { id } });
    if (!oldProduct) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    const { name, description, price, categoryIds, discount, imageUrl } =
      req.body;

    let parsedCategoryIds: string[] = [];
    if (categoryIds) {
      parsedCategoryIds = Array.isArray(categoryIds)
        ? categoryIds
        : JSON.parse(categoryIds);
    }

    if (parsedCategoryIds.length > 0) {
      const existingCategories = await prisma.category.findMany({
        where: { id: { in: parsedCategoryIds } },
      });
      if (existingCategories.length !== parsedCategoryIds.length) {
        return res
          .status(400)
          .json({ error: "Uma ou mais categorias não existem" });
      }
    }

    const updateData: any = {
      name: name ?? oldProduct.name,
      description: description ?? oldProduct.description,
      price: price ? parseFloat(price) : oldProduct.price,
      discount: discount ? parseFloat(discount) : oldProduct.discount ?? null,
      imageUrl: imageUrl ?? oldProduct.imageUrl,
    };

    if (parsedCategoryIds.length > 0) {
      updateData.categories = {
        set: parsedCategoryIds.map((id: string) => ({ id })),
      };
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { categories: true },
    });

    res.json(product);
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ error: "Erro interno ao atualizar produto" });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const { id } = req.params;

  const product = await prisma.product.findUnique({ where: { id } });

  if (product?.imageUrl) {
    const fileId = product.imageUrl.split("id=")[1];
    await deleteFromDrive(fileId);
  }

  await prisma.product.delete({ where: { id } });
  res.status(204).send().json({
    message: "Product deleted successfully",
  });
};
