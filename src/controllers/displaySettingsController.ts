import { Request, Response } from "express";
import { prisma } from "../utils/prismaClient";
import { Product } from "@prisma/client";

export const getDisplaySettings = async (req: Request, res: Response) => {
  try {
    const displaySections = await prisma.displaySection.findMany({
      orderBy: { order: "asc" },
      include: { category: true },
    });

    const now = new Date();
    const formattedSections = await Promise.all(
      displaySections
        .filter((section) => {
          if (!section.active) return false;
          if (section.startDate && section.startDate > now) return false;
          if (section.endDate && section.endDate < now) return false;
          return true;
        })
        .map(async (section) => {
          let products: Product[] = [];

          try {
            switch (section.type) {
              case "category":
                if (section.categoryId) {
                  products = await prisma.product.findMany({
                    where: {
                      categories: { some: { id: section.categoryId } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 10,
                  });
                }
                break;

              case "custom":
                if (section.productIds) {
                  try {
                    const productIds = JSON.parse(section.productIds);
                    if (Array.isArray(productIds) && productIds.length > 0) {
                      products = await prisma.product.findMany({
                        where: {
                          id: { in: productIds },
                        },
                        orderBy: { createdAt: "desc" },
                      });
                    }
                  } catch (parseError) {
                    console.error("Erro ao parsear productIds:", parseError);
                  }
                }
                break;

              case "discounted":
                products = await prisma.product.findMany({
                  where: {
                    discount: { not: null },
                    AND: { discount: { gt: 0 } },
                  },
                  orderBy: { discount: "desc" },
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
            // Se houver erro no processamento de uma seção, continuamos com produtos vazios
            // em vez de falhar toda a requisição
          }

          // Tratamento seguro para conversão JSON
          let productIdsArray;
          let tagsArray;

          try {
            productIdsArray = section.productIds
              ? JSON.parse(section.productIds)
              : undefined;
          } catch (error) {
            console.error(
              `Erro ao parsear productIds da seção ${section.id}:`,
              error
            );
            productIdsArray = undefined;
          }

          try {
            tagsArray = section.tags ? JSON.parse(section.tags) : undefined;
          } catch (error) {
            console.error(
              `Erro ao parsear tags da seção ${section.id}:`,
              error
            );
            tagsArray = undefined;
          }

          return {
            ...section,
            products,
            productIds: productIdsArray,
            tags: tagsArray,
          };
        })
    );

    res.json(formattedSections);
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

    // Validar tipo
    const validTypes = ["category", "custom", "discounted", "new_arrivals"];
    if (!validTypes.includes(section.type)) {
      res.status(400).json({
        error: `Tipo inválido: ${
          section.type
        }. Tipos válidos: ${validTypes.join(", ")}`,
      });
      return;
    }

    // Validar categoria
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

    // Validar produtos
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

    // Validar datas
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

    // Obter última ordem
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
        order: section.order !== undefined ? section.order : nextOrder,
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

    // Verificar se seção existe
    const existingSection = await prisma.displaySection.findUnique({
      where: { id },
    });

    if (!existingSection) {
      res.status(404).json({
        error: "Seção não encontrada",
      });
      return;
    }

    // Validar tipo
    if (section.type) {
      const validTypes = ["category", "custom", "discounted", "new_arrivals"];
      if (!validTypes.includes(section.type)) {
        res.status(400).json({
          error: `Tipo inválido: ${
            section.type
          }. Tipos válidos: ${validTypes.join(", ")}`,
        });
        return;
      }
    }

    // Validar categoria
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

    // Validar produtos
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

    // Validar datas
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
        title: section.title,
        type: section.type,
        active: section.active,
        categoryId: section.categoryId,
        productIds: section.productIds
          ? JSON.stringify(section.productIds)
          : undefined,
        order: section.order,
        startDate: section.startDate ? new Date(section.startDate) : undefined,
        endDate: section.endDate ? new Date(section.endDate) : undefined,
        tags: section.tags ? JSON.stringify(section.tags) : undefined,
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

export const deleteDisplaySection = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Verificar se seção existe
    const existingSection = await prisma.displaySection.findUnique({
      where: { id },
    });

    if (!existingSection) {
      res.status(404).json({
        error: "Seção não encontrada",
      });
      return;
    }

    await prisma.displaySection.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Seção excluída com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir seção:", error);
    res.status(500).json({
      error: "Erro ao excluir seção",
      details: (error as Error).message,
    });
  }
};
