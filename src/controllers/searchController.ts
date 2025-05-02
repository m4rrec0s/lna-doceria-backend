import { Request, Response } from "express";
import { prisma } from "../utils/prismaClient";

export const searchProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const skip = (page - 1) * per_page;

    if (!query) {
      res.status(400).json({ error: "Campo de busca não pode ser vazio" });
      return;
    }

    const searchTerm = query as string;

    const nameMatchProducts = await prisma.product.findMany({
      where: {
        name: { contains: searchTerm, mode: "insensitive" },
        active: true,
      },
      include: {
        categories: {
          include: {
            flavors: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const nameMatchIds = nameMatchProducts.map((product) => product.id);

    const otherMatchProducts = await prisma.product.findMany({
      where: {
        id: { notIn: nameMatchIds },
        OR: [
          { description: { contains: searchTerm, mode: "insensitive" } },
          {
            categories: {
              some: {
                name: { contains: searchTerm, mode: "insensitive" },
              },
            },
          },
          {
            categories: {
              some: {
                flavors: {
                  some: {
                    name: { contains: searchTerm, mode: "insensitive" },
                  },
                },
              },
            },
          },
        ],
        active: true,
      },
      include: {
        categories: {
          include: {
            flavors: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const allProducts = [...nameMatchProducts, ...otherMatchProducts];
    const totalCount = allProducts.length;
    const paginatedProducts = allProducts.slice(skip, skip + per_page);

    res.json({
      data: paginatedProducts,
      pagination: {
        total: totalCount,
        page,
        per_page,
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

export const searchCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const skip = (page - 1) * per_page;

    if (!query) {
      res.status(400).json({ error: "Campo de busca não pode ser vazio" });
      return;
    }

    const [categories, totalCount] = await Promise.all([
      prisma.category.findMany({
        where: {
          name: { contains: query as string, mode: "insensitive" },
        },
        skip,
        take: per_page,
        include: { flavors: true },
      }),
      prisma.category.count({
        where: {
          name: { contains: query as string, mode: "insensitive" },
        },
      }),
    ]);

    res.json({
      data: categories,
      pagination: {
        total: totalCount,
        page,
        per_page,
        total_pages: Math.ceil(totalCount / per_page),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    res.status(500).json({
      error: "Erro interno ao buscar categorias",
      details:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};

export const searchFlavors = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const skip = (page - 1) * per_page;

    if (!query) {
      res.status(400).json({ error: "Campo de busca não pode ser vazio" });
      return;
    }

    const [flavors, totalCount] = await Promise.all([
      prisma.flavor.findMany({
        where: {
          name: { contains: query as string, mode: "insensitive" },
        },
        skip,
        take: per_page,
        include: { category: true },
      }),
      prisma.flavor.count({
        where: {
          name: { contains: query as string, mode: "insensitive" },
        },
      }),
    ]);

    res.json({
      data: flavors,
      pagination: {
        total: totalCount,
        page,
        per_page,
        total_pages: Math.ceil(totalCount / per_page),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar sabores:", error);
    res.status(500).json({
      error: "Erro interno ao buscar sabores",
      details:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};
