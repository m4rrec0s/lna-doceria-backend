import { Request, Response } from "express";
import { prisma } from "../utils/prismaClient";

export const getDisplaySettings = async (req: Request, res: Response) => {
  try {
    const displaySections = await prisma.displaySection.findMany({
      orderBy: { order: "asc" },
      include: { category: true },
    });

    // Converter productIds de string JSON para array
    const formattedSections = displaySections.map((section) => ({
      ...section,
      productIds: section.productIds
        ? JSON.parse(section.productIds)
        : undefined,
    }));

    res.json(formattedSections);
  } catch (error) {
    console.error("Erro ao buscar configurações de exibição:", error);
    res.status(500).json({ error: "Erro ao buscar configurações de exibição" });
  }
};

export const saveDisplaySettings = async (req: Request, res: Response) => {
  try {
    const sections = req.body;

    if (!Array.isArray(sections)) {
      res
        .status(400)
        .json({ error: "Formato de dados inválido. Array esperado." });
      return;
    }

    // Transação do Prisma para garantir consistência
    await prisma.$transaction(async (tx) => {
      // Limpar configurações existentes
      await tx.displaySection.deleteMany({});

      // Criar novas configurações
      await Promise.all(
        sections.map(async (section, index) => {
          // Converter array de productIds para JSON string quando necessário
          const productIdsString = section.productIds
            ? JSON.stringify(section.productIds)
            : null;

          return tx.displaySection.create({
            data: {
              title: section.title,
              type: section.type,
              active: section.active ?? true,
              categoryId: section.categoryId || null,
              productIds: productIdsString,
              order: section.order !== undefined ? section.order : index, // Usar ordem fornecida ou índice como fallback
            },
          });
        })
      );
    });

    res.json({
      success: true,
      message: "Configurações salvas com sucesso",
    });
  } catch (error) {
    console.error("Erro ao salvar configurações de exibição:", error);
    res.status(500).json({
      error: "Erro ao salvar configurações",
      details: (error as Error).message,
    });
  }
};
