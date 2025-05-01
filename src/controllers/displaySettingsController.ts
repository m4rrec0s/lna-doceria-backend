import { Request, Response } from "express";
import { prisma } from "../utils/prismaClient";
import { Product } from "@prisma/client";

export const getDisplaySettings = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 2;
    const skip = (page - 1) * limit;

    const displaySections = await prisma.displaySection.findMany({
      orderBy: { order: "asc" },
      include: { category: true },
      skip,
      take: limit,
    });

    const totalSections = await prisma.displaySection.count();
    const now = new Date();
    const activeSections = displaySections.filter((section) => {
      if (section.startDate && section.startDate > now) return false;
      if (section.endDate && section.endDate < now) return false;
      return true;
    });

    const formattedSections = await Promise.all(
      activeSections.map(async (section) => {
        let products: Product[] = [];

        try {
          switch (section.type) {
            case "category":
              if (section.categoryId) {
                products = await prisma.product.findMany({
                  where: {
                    categories: { some: { id: section.categoryId } },
                    active: true,
                  },
                  orderBy: { createdAt: "desc" },
                  take: 10,
                });
              }
              break;

            case "custom":
              if (section.productIds) {
                try {
                  let productIds: string[] = [];

                  try {
                    const cleanString = section.productIds.replace(/\\"/g, '"');

                    const parsedData = JSON.parse(cleanString);

                    if (Array.isArray(parsedData)) {
                      productIds = parsedData;
                    } else if (typeof parsedData === "string") {
                      try {
                        const secondParse = JSON.parse(parsedData);
                        if (Array.isArray(secondParse)) {
                          productIds = secondParse;
                        }
                      } catch (e) {
                        console.error("Erro no segundo parse:", e);
                      }
                    }
                  } catch (parseError) {
                    const guidPattern =
                      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
                    const matches = section.productIds.match(guidPattern);

                    if (matches && matches.length > 0) {
                      productIds = matches;
                    }
                  }

                  if (productIds.length > 0) {
                    products = await prisma.product.findMany({
                      where: {
                        id: { in: productIds },
                        active: true,
                      },
                      include: {
                        categories: true,
                      },
                    });

                    if (products.length > 0) {
                      const productMap = new Map(
                        products.map((p) => [p.id, p])
                      );
                      products = productIds
                        .map((id) => productMap.get(id))
                        .filter(Boolean) as Product[];
                    }
                  }
                } catch (error) {
                  console.error(
                    `Erro ao processar produtos da seção ${section.id}:`,
                    error
                  );
                }
              }
              break;

            case "discounted":
              products = await prisma.product.findMany({
                where: { discount: { not: null, gt: 0 }, active: true },
                orderBy: { discount: "desc" },
                include: { categories: true },
                take: 10,
              });
              break;

            case "new_arrivals":
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              products = await prisma.product.findMany({
                where: { createdAt: { gte: thirtyDaysAgo } },
                orderBy: { createdAt: "desc" },
                take: 10,
              });
              break;
          }
        } catch (sectionError) {
          console.error(
            `Erro ao processar seção ${section.id} (${section.title}):`,
            sectionError
          );
        }

        const productIdsArray = section.productIds
          ? JSON.parse(section.productIds)
          : [];
        const tagsArray = section.tags ? JSON.parse(section.tags) : [];

        return {
          ...section,
          productIds: productIdsArray,
          tags: tagsArray,
          products: products || [],
        };
      })
    );

    res.json({
      sections: formattedSections,
      total: totalSections,
      page,
      limit,
      hasMore: skip + formattedSections.length < totalSections,
    });
  } catch (error) {
    console.error("Erro ao buscar configurações de exibição:", error);
    res.status(500).json({
      error: "Erro ao buscar configurações de exibição",
      details:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};

export const createDisplaySection = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const section = req.body;
    const validTypes = ["category", "custom", "discounted", "new_arrivals"];

    if (!validTypes.includes(section.type)) {
      res.status(400).json({
        error: `Tipo inválido: ${
          section.type
        }. Tipos válidos: ${validTypes.join(", ")}`,
      });
      return;
    }

    if (section.type === "category" && section.categoryId) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: section.categoryId },
      });
      if (!categoryExists) {
        res.status(400).json({
          error: `Categoria com ID ${section.categoryId} não encontrada.`,
        });
        return;
      }
    }

    if (section.type === "custom" && section.productIds) {
      const productIds = Array.isArray(section.productIds)
        ? section.productIds
        : [];
      const productsCount = await prisma.product.count({
        where: { id: { in: productIds } },
      });
      if (productsCount !== productIds.length) {
        res.status(400).json({
          error: "Alguns IDs de produtos são inválidos.",
        });
        return;
      }
    }

    if (section.startDate && section.endDate) {
      const start = new Date(section.startDate);
      const end = new Date(section.endDate);
      if (start > end) {
        res.status(400).json({
          error: "Data de início deve ser anterior à data de término.",
        });
        return;
      }
    }

    const lastSection = await prisma.displaySection.findFirst({
      orderBy: { order: "desc" },
    });
    const nextOrder = (lastSection?.order ?? -1) + 1;

    const newSection = await prisma.displaySection.create({
      data: {
        title: section.title,
        type: section.type,
        active: section.active ?? true,
        categoryId: section.categoryId || null,
        productIds: section.productIds
          ? JSON.stringify(section.productIds)
          : null,
        order: section.order ?? nextOrder,
        startDate: section.startDate ? new Date(section.startDate) : null,
        endDate: section.endDate ? new Date(section.endDate) : null,
        tags: section.tags ? JSON.stringify(section.tags) : null,
      },
    });

    res.json(newSection);
  } catch (error) {
    console.error("Erro ao criar seção:", error);
    res.status(500).json({
      error: "Erro ao criar seção",
      details: (error as Error).message,
    });
  }
};

export const updateDisplaySection = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const section = req.body;

    const existingSection = await prisma.displaySection.findUnique({
      where: { id },
    });
    if (!existingSection) {
      res.status(404).json({ error: "Seção não encontrada" });
      return;
    }

    const validTypes = ["category", "custom", "discounted", "new_arrivals"];
    if (section.type && !validTypes.includes(section.type)) {
      res.status(400).json({
        error: `Tipo inválido: ${
          section.type
        }. Tipos válidos: ${validTypes.join(", ")}`,
      });
      return;
    }

    if (section.type === "category" && section.categoryId) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: section.categoryId },
      });
      if (!categoryExists) {
        res.status(400).json({
          error: `Categoria com ID ${section.categoryId} não encontrada.`,
        });
        return;
      }
    }

    if (section.type === "custom" && section.productIds) {
      const productIds = Array.isArray(section.productIds)
        ? section.productIds
        : [];
      const productsCount = await prisma.product.count({
        where: { id: { in: productIds } },
      });
      if (productsCount !== productIds.length) {
        res.status(400).json({
          error: "Alguns IDs de produtos são inválidos.",
        });
        return;
      }
    }

    if (section.startDate && section.endDate) {
      const start = new Date(section.startDate);
      const end = new Date(section.endDate);
      if (start > end) {
        res.status(400).json({
          error: "Data de início deve ser anterior à data de término.",
        });
        return;
      }
    }

    const updatedSection = await prisma.displaySection.update({
      where: { id },
      data: {
        title: section.title ?? existingSection.title,
        type: section.type ?? existingSection.type,
        active: section.active ?? existingSection.active,
        categoryId: section.categoryId ?? existingSection.categoryId,
        productIds: section.productIds
          ? JSON.stringify(section.productIds)
          : existingSection.productIds,
        order: section.order ?? existingSection.order,
        startDate: section.startDate
          ? new Date(section.startDate)
          : existingSection.startDate,
        endDate: section.endDate
          ? new Date(section.endDate)
          : existingSection.endDate,
        tags: section.tags
          ? JSON.stringify(section.tags)
          : existingSection.tags,
      },
    });

    res.json(updatedSection);
  } catch (error) {
    console.error("Erro ao atualizar seção:", error);
    res.status(500).json({
      error: "Erro ao atualizar seção",
      details: (error as Error).message,
    });
  }
};

export const updateAllDisplaySections = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const sections = req.body;

    if (!Array.isArray(sections)) {
      res.status(400).json({
        error: "Dados inválidos. É necessário enviar um array de seções.",
      });
      return;
    }

    interface UpdateResult {
      section: any;
      error: string;
    }

    interface ErrorResult {
      section: any;
      error: string;
    }

    const results: UpdateResult[] = [];
    const errors: ErrorResult[] = [];

    await prisma.$transaction(async (tx) => {
      for (const section of sections) {
        if (!section.id) {
          errors.push({ section, error: "ID da seção não fornecido" });
          continue;
        }

        const existingSection = await tx.displaySection.findUnique({
          where: { id: section.id },
        });

        if (!existingSection) {
          errors.push({
            section,
            error: `Seção com ID ${section.id} não encontrada`,
          });
          continue;
        }

        const validTypes = ["category", "custom", "discounted", "new_arrivals"];
        if (section.type && !validTypes.includes(section.type)) {
          errors.push({
            section,
            error: `Tipo inválido: ${
              section.type
            }. Tipos válidos: ${validTypes.join(", ")}`,
          });
          continue;
        }

        if (section.type === "category" && section.categoryId) {
          const categoryExists = await tx.category.findUnique({
            where: { id: section.categoryId },
          });
          if (!categoryExists) {
            errors.push({
              section,
              error: `Categoria com ID ${section.categoryId} não encontrada.`,
            });
            continue;
          }
        }

        if (section.type === "custom" && section.productIds) {
          const productIds = Array.isArray(section.productIds)
            ? section.productIds
            : [];
          const productsCount = await tx.product.count({
            where: { id: { in: productIds } },
          });
          if (productsCount !== productIds.length) {
            errors.push({
              section,
              error: "Alguns IDs de produtos são inválidos.",
            });
            continue;
          }
        }

        if (section.startDate && section.endDate) {
          const start = new Date(section.startDate);
          const end = new Date(section.endDate);
          if (start > end) {
            errors.push({
              section,
              error: "Data de início deve ser anterior à data de término.",
            });
            continue;
          }
        }

        const updatedSection = await tx.displaySection.update({
          where: { id: section.id },
          data: {
            title: section.title ?? existingSection.title,
            type: section.type ?? existingSection.type,
            active: section.active ?? existingSection.active,
            categoryId: section.categoryId ?? existingSection.categoryId,
            productIds: section.productIds
              ? JSON.stringify(section.productIds)
              : existingSection.productIds,
            order: section.order ?? existingSection.order,
            startDate: section.startDate
              ? new Date(section.startDate)
              : existingSection.startDate,
            endDate: section.endDate
              ? new Date(section.endDate)
              : existingSection.endDate,
            tags: section.tags
              ? JSON.stringify(section.tags)
              : existingSection.tags,
          },
        });

        results.push({ section: updatedSection, error: "" });
      }
    });

    res.json({
      success: true,
      updatedSections: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Erro ao atualizar seções:", error);
    res.status(500).json({
      error: "Erro ao atualizar seções",
      details: (error as Error).message,
    });
  }
};

export const deleteDisplaySection = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const existingSection = await prisma.displaySection.findUnique({
      where: { id },
    });

    if (!existingSection) {
      res.status(404).json({ error: "Seção não encontrada" });
      return;
    }

    await prisma.displaySection.delete({ where: { id } });

    res.json({ success: true, message: "Seção excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir seção:", error);
    res.status(500).json({
      error: "Erro ao excluir seção",
      details: (error as Error).message,
    });
  }
};
