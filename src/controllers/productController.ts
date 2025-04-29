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

    // Simplifica a manipulação de categoryIds
    let parsedCategoryIds: string[] = [];
    if (categoryIds) {
      parsedCategoryIds = Array.isArray(categoryIds)
        ? categoryIds
        : typeof categoryIds === "string"
        ? JSON.parse(categoryIds)
        : [];

      if (!Array.isArray(parsedCategoryIds)) {
        return res.status(400).json({ error: "categoryIds deve ser um array" });
      }
    }

    // Verifica se as categorias existem
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
          ? { connect: parsedCategoryIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { categories: true },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({
      error: "Erro interno ao criar produto",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const skip = (page - 1) * per_page;

    // Busca simplificada com tratamento de erro claro
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: per_page,
        orderBy: { createdAt: "desc" },
        include: { categories: true }, // Inclui categorias para consistência
      }),
      prisma.product.count(),
    ]);

    res.json({
      data: products,
      pagination: {
        total: totalCount,
        page,
        per_page,
        total_pages: Math.ceil(totalCount / per_page),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar produtos:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      prismaVersion: require("@prisma/client/package.json").version,
      nodeEnv: process.env.NODE_ENV,
    });

    res.status(500).json({
      error: "Erro interno ao buscar produtos",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

export const getActiveProducts = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const per_page = req.query.per_page
      ? parseInt(req.query.per_page as string)
      : 50;
    const skip = (page - 1) * per_page;

    const products = await prisma.product.findMany({
      where: { active: true },
      skip,
      take: per_page,
      orderBy: { createdAt: "desc" },
    });

    const totalCount = await prisma.product.count({ where: { active: true } });

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
    console.error("Erro ao buscar produtos ativos:", error);
    res.status(500).json({
      error: "Erro interno ao buscar produtos ativos",
      details:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};

export const getInactiveProducts = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const per_page = req.query.per_page
      ? parseInt(req.query.per_page as string)
      : 50;
    const skip = (page - 1) * per_page;

    const products = await prisma.product.findMany({
      where: { active: false },
      skip,
      take: per_page,
      orderBy: { createdAt: "desc" },
    });

    const totalCount = await prisma.product.count({ where: { active: false } });

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
    console.error("Erro ao buscar produtos inativos:", error);
    res.status(500).json({
      error: "Erro interno ao buscar produtos inativos",
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

    // Simplifica a manipulação de categoryIds
    let parsedCategoryIds: string[] = [];
    if (categoryIds) {
      parsedCategoryIds = Array.isArray(categoryIds)
        ? categoryIds
        : typeof categoryIds === "string"
        ? JSON.parse(categoryIds)
        : [];

      if (!Array.isArray(parsedCategoryIds)) {
        return res.status(400).json({ error: "categoryIds deve ser um array" });
      }
    }

    // Verifica se as categorias existem
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
        set: parsedCategoryIds.map((id) => ({ id })),
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
    res.status(500).json({
      error: "Erro interno ao atualizar produto",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

export const deleteProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }

    if (product.imageUrl) {
      const fileId = product.imageUrl.split("id=")[1];
      await deleteFromDrive(fileId).catch((err) => {
        console.warn("Erro ao deletar imagem do Google Drive:", err.message);
      });
    }

    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar produto:", error);
    res.status(500).json({
      error: "Erro interno ao deletar produto",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};
