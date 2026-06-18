import { Request, Response } from "express";
import { prisma } from "../utils/prismaClient";
import { deleteFromDrive } from "../config/googleDriveConfig";

const parseStringArray = (value: unknown, fieldName: string) => {
  if (value === null || value === undefined) {
    return { values: [] as string[] };
  }

  if (Array.isArray(value)) {
    return { values: value.map((item) => String(item)).filter(Boolean) };
  }

  if (typeof value !== "string") {
    return {
      values: [] as string[],
      error: `${fieldName} deve ser um array`,
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { values: [] as string[] };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return {
        values: parsed.map((item) => String(item)).filter(Boolean),
      };
    }
    if (typeof parsed === "string" && parsed.trim()) {
      return { values: [parsed.trim()] };
    }
    return {
      values: [] as string[],
      error: `${fieldName} deve ser um array`,
    };
  } catch {
    const values = trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (values.length > 0) {
      return { values };
    }
    return {
      values: [] as string[],
      error: `${fieldName} deve ser um array`,
    };
  }
};

const parseFlavorRange = (minValue: unknown, maxValue: unknown) => {
  const minFlavors = Number(minValue ?? 0);
  const maxFlavors = Number(maxValue ?? 0);

  if (
    Number.isNaN(minFlavors) ||
    Number.isNaN(maxFlavors) ||
    minFlavors < 0 ||
    maxFlavors < 0
  ) {
    return { error: "Valores de sabores inválidos" };
  }

  if (maxFlavors < minFlavors) {
    return { error: "maxFlavors deve ser maior ou igual a minFlavors" };
  }

  return {
    minFlavors: Math.floor(minFlavors),
    maxFlavors: Math.floor(maxFlavors),
  };
};

const parseUnitRange = (
  minValue: unknown,
  maxValue: unknown,
  requireMin: boolean,
) => {
  const isEmpty = (value: unknown) =>
    value === undefined || value === null || value === "";

  if (isEmpty(minValue) && isEmpty(maxValue)) {
    if (requireMin) {
      return {
        error:
          "minUnitQuantity é obrigatório quando o preço unitário estiver definido",
      };
    }
    return { minQuantity: null as number | null, maxQuantity: null as number | null };
  }

  if (isEmpty(minValue)) {
    return {
      error: "minUnitQuantity é obrigatório quando maxUnitQuantity é informado",
    };
  }

  const minQuantity = Number(minValue);
  if (Number.isNaN(minQuantity) || minQuantity <= 0) {
    return { error: "minUnitQuantity deve ser maior que 0" };
  }

  let maxQuantity: number | null = null;
  if (!isEmpty(maxValue)) {
    const parsedMax = Number(maxValue);
    if (Number.isNaN(parsedMax) || parsedMax < minQuantity) {
      return { error: "maxUnitQuantity deve ser maior ou igual ao mínimo" };
    }
    maxQuantity = Math.floor(parsedMax);
  }

  return {
    minQuantity: Math.floor(minQuantity),
    maxQuantity,
  };
};

type PackagePrice = {
  quantity: number;
  price: number;
  discount?: number;
};

const parseNumberArray = (value: unknown, fieldName: string) => {
  if (value === null || value === undefined || value === "") {
    return { values: [] as number[] };
  }

  const parsedValue =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return value
              .split(",")
              .map((item) => Number(item.trim()))
              .filter((item) => !Number.isNaN(item) && item > 0);
          }
        })()
      : value;

  if (!Array.isArray(parsedValue)) {
    return { error: `${fieldName} deve ser um array` };
  }

  const normalized = parsedValue
    .map((item) => Number(item))
    .filter((item) => !Number.isNaN(item) && item > 0)
    .map((item) => Math.floor(item))
    .sort((a, b) => a - b);

  return { values: normalized };
};

const parsePackagePrices = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return { packagePrices: [] as PackagePrice[] };
  }

  const parsedValue =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        })()
      : value;

  if (!Array.isArray(parsedValue)) {
    return { error: "packagePrices deve ser um array" };
  }

  const normalized = parsedValue
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const quantity = Number((item as { quantity?: unknown }).quantity);
      const price = Number((item as { price?: unknown }).price);
      const rawDiscount = (item as { discount?: unknown }).discount;
      const parsedDiscount =
        rawDiscount === undefined || rawDiscount === null || rawDiscount === ""
          ? null
          : Number(rawDiscount);
      if (
        Number.isNaN(quantity) ||
        Number.isNaN(price) ||
        quantity <= 0 ||
        price < 0 ||
        (parsedDiscount !== null &&
          (Number.isNaN(parsedDiscount) ||
            parsedDiscount < 0 ||
            parsedDiscount > 100))
      ) {
        return null;
      }
      return {
        quantity: Math.floor(quantity),
        price,
        ...(parsedDiscount === null ? {} : { discount: parsedDiscount }),
      };
    })
    .filter((item): item is PackagePrice => item !== null)
    .sort((a, b) => a.quantity - b.quantity);

  return { packagePrices: normalized };
};

const normalizeProductForResponse = <
  T extends {
    packagePrices?: string | null;
    gramsPrices?: string | null;
    gramsOptions?: string | null;
    imageUrls?: string | null;
  },
>(
  product: T,
) => {
  const parsedPackagePrices = parsePackagePrices(product.packagePrices);
  const parsedGramsPrices = parsePackagePrices(product.gramsPrices);
  const parsedGrams = parseNumberArray(product.gramsOptions, "gramsOptions");
  const parsedImageUrls = parseStringArray(product.imageUrls, "imageUrls");

  return {
    ...product,
    packagePrices:
      "error" in parsedPackagePrices ? [] : parsedPackagePrices.packagePrices,
    gramsPrices:
      "error" in parsedGramsPrices ? [] : parsedGramsPrices.packagePrices,
    gramsOptions: "error" in parsedGrams ? [] : parsedGrams.values,
    imageUrls: "error" in parsedImageUrls ? [] : parsedImageUrls.values,
  };
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      categoryIds,
      discount,
      imageUrl,
      imageUrls,
      gramsOptions,
      gramsPrices,
      minFlavors,
      maxFlavors,
      packagePrices,
      unitMinQuantity,
      unitMaxQuantity,
    } = req.body;

    const { values: parsedCategoryIds, error: categoryIdsError } =
      parseStringArray(categoryIds, "categoryIds");
    if (categoryIdsError) {
      return res.status(400).json({ error: categoryIdsError });
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
    const flavorRange = parseFlavorRange(minFlavors, maxFlavors);
    if ("error" in flavorRange) {
      return res.status(400).json({ error: flavorRange.error });
    }

    const parsedPackagePrices = parsePackagePrices(packagePrices);
    if ("error" in parsedPackagePrices) {
      return res.status(400).json({ error: parsedPackagePrices.error });
    }
    const parsedGramsPrices = parsePackagePrices(gramsPrices);
    if ("error" in parsedGramsPrices) {
      return res.status(400).json({ error: parsedGramsPrices.error });
    }

    const parsedGramsOptions = parseNumberArray(gramsOptions, "gramsOptions");
    if ("error" in parsedGramsOptions) {
      return res.status(400).json({ error: parsedGramsOptions.error });
    }

    const parsedImageUrls = parseStringArray(imageUrls, "imageUrls");
    if ("error" in parsedImageUrls) {
      return res.status(400).json({ error: parsedImageUrls.error });
    }

    const normalizedImageUrls = [
      ...new Set(
        [
          ...(imageUrl ? [String(imageUrl)] : []),
          ...parsedImageUrls.values,
        ].filter(Boolean),
      ),
    ];

    const parsedBasePrice =
      price === undefined || price === null || price === ""
        ? null
        : Number(price);
    const hasVariablePrices =
      parsedPackagePrices.packagePrices.length > 0 ||
      parsedGramsPrices.packagePrices.length > 0;

    if (
      parsedBasePrice !== null &&
      (Number.isNaN(parsedBasePrice) || parsedBasePrice < 0)
    ) {
      return res.status(400).json({ error: "Preço inválido" });
    }

    const hasUnitPrice =
      parsedBasePrice !== null &&
      !Number.isNaN(parsedBasePrice) &&
      parsedBasePrice > 0;
    const unitRange = parseUnitRange(
      unitMinQuantity,
      unitMaxQuantity,
      hasUnitPrice,
    );
    if ("error" in unitRange) {
      return res.status(400).json({ error: unitRange.error });
    }

    if (
      !name ||
      !description ||
      normalizedImageUrls.length === 0 ||
      (!hasVariablePrices &&
        (parsedBasePrice === null ||
          Number.isNaN(parsedBasePrice) ||
          parsedBasePrice < 0))
    ) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price:
          parsedBasePrice !== null && !Number.isNaN(parsedBasePrice)
            ? parsedBasePrice
            : 0,
        unitMinQuantity: unitRange.minQuantity,
        unitMaxQuantity: unitRange.maxQuantity,
        imageUrl: normalizedImageUrls[0],
        imageUrls: JSON.stringify(normalizedImageUrls),
        gramsOptions: parsedGramsOptions.values.length
          ? JSON.stringify(parsedGramsOptions.values)
          : null,
        gramsPrices: parsedGramsPrices.packagePrices.length
          ? JSON.stringify(parsedGramsPrices.packagePrices)
          : null,
        discount: discountValue,
        minFlavors: flavorRange.minFlavors,
        maxFlavors: flavorRange.maxFlavors,
        packagePrices: parsedPackagePrices.packagePrices.length
          ? JSON.stringify(parsedPackagePrices.packagePrices)
          : null,
        categories: parsedCategoryIds.length
          ? { connect: parsedCategoryIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { categories: true },
    });

    res.status(201).json(normalizeProductForResponse(product));
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({
      error: "Erro interno ao criar produto",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const skip = (page - 1) * per_page;

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: per_page,
        orderBy: { name: "asc" },
        include: { categories: true },
      }),
      prisma.product.count(),
    ]);

    res.json({
      data: products.map(normalizeProductForResponse),
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

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const skip = (page - 1) * per_page;

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: per_page,
        where: {
          active: true,
        },
        orderBy: { name: "asc" },
        include: { categories: true },
      }),
      prisma.product.count(),
    ]);

    res.json({
      data: products.map(normalizeProductForResponse),
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

export const getProductById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { categories: true },
    });

    if (!product) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }

    res.json(normalizeProductForResponse(product));
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    res.status(500).json({
      error: "Erro interno ao buscar produto",
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

export const getProductsByCategoryId = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const per_page = parseInt(req.query.per_page as string) || 50;
    const skip = (page - 1) * per_page;

    if (!id) {
      res.status(400).json({ error: "Category ID is required" });
      return;
    }

    const categoryExists = await prisma.category.findUnique({
      where: { id },
    });

    if (!categoryExists) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: {
          categories: {
            some: { id },
          },
          active: true,
        },
        skip,
        take: per_page,
        orderBy: { name: "asc" },
        include: { categories: true },
      }),
      prisma.product.count({
        where: {
          categories: {
            some: { id }, // Alterado para usar a variável id
          },
          active: true,
        },
      }),
    ]);

    res.json({
      data: products.map(normalizeProductForResponse),
      pagination: {
        total: totalCount,
        page,
        per_page,
        total_pages: Math.ceil(totalCount / per_page),
      },
    });
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({
      error: "Internal error while fetching products by category",
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

    const {
      name,
      description,
      price,
      active,
      categoryIds,
      discount,
      imageUrl,
      imageUrls,
      gramsOptions,
      gramsPrices,
      minFlavors,
      maxFlavors,
      packagePrices,
      unitMinQuantity,
      unitMaxQuantity,
    } = req.body;

    const hasUnitPriceInRequest =
      price !== undefined && price !== null && price !== "" && Number(price) > 0;
    const hasUnitMinInRequest = unitMinQuantity !== undefined && unitMinQuantity !== null && unitMinQuantity !== "";
    const hasUnitMaxInRequest = unitMaxQuantity !== undefined && unitMaxQuantity !== null && unitMaxQuantity !== "";
    const hasUnitRangeInRequest =
      hasUnitMinInRequest ||
      hasUnitMaxInRequest ||
      hasUnitPriceInRequest;

    const unitRangeExplicitlyCleaned =
      unitMinQuantity !== undefined && !hasUnitMinInRequest &&
      unitMaxQuantity !== undefined && !hasUnitMaxInRequest;

    let unitRange: { minQuantity: number | null; maxQuantity: number | null } | null = null;
    if (unitRangeExplicitlyCleaned) {
      unitRange = { minQuantity: null, maxQuantity: null };
    } else if (hasUnitRangeInRequest) {
      const result = parseUnitRange(
        unitMinQuantity,
        unitMaxQuantity,
        hasUnitPriceInRequest,
      );
      if ("error" in result) {
        return res.status(400).json({ error: result.error });
      }
      unitRange = result;
    }

    const parsedMinFlavors =
      minFlavors !== undefined ? Number(minFlavors) : oldProduct.minFlavors;
    const parsedMaxFlavors =
      maxFlavors !== undefined ? Number(maxFlavors) : oldProduct.maxFlavors;

    const flavorRange = parseFlavorRange(parsedMinFlavors, parsedMaxFlavors);
    if ("error" in flavorRange) {
      return res.status(400).json({ error: flavorRange.error });
    }

    const parsedPackagePrices =
      packagePrices !== undefined
        ? parsePackagePrices(packagePrices)
        : parsePackagePrices(oldProduct.packagePrices);
    if ("error" in parsedPackagePrices) {
      return res.status(400).json({ error: parsedPackagePrices.error });
    }
    const parsedGramsPrices =
      gramsPrices !== undefined
        ? parsePackagePrices(gramsPrices)
        : parsePackagePrices(oldProduct.gramsPrices);
    if ("error" in parsedGramsPrices) {
      return res.status(400).json({ error: parsedGramsPrices.error });
    }

    const parsedGramsOptions =
      gramsOptions !== undefined
        ? parseNumberArray(gramsOptions, "gramsOptions")
        : parseNumberArray(oldProduct.gramsOptions, "gramsOptions");
    if ("error" in parsedGramsOptions) {
      return res.status(400).json({ error: parsedGramsOptions.error });
    }

    const parsedImageUrls =
      imageUrls !== undefined
        ? parseStringArray(imageUrls, "imageUrls")
        : parseStringArray(oldProduct.imageUrls, "imageUrls");
    if ("error" in parsedImageUrls) {
      return res.status(400).json({ error: parsedImageUrls.error });
    }

    const oldImageUrlsParsed = parseStringArray(
      oldProduct.imageUrls,
      "imageUrls",
    );
    if ("error" in oldImageUrlsParsed) {
      return res.status(400).json({ error: oldImageUrlsParsed.error });
    }

    const normalizedImageUrls =
      imageUrls !== undefined
        ? [
            ...new Set(
              [
                ...(imageUrl ? [String(imageUrl)] : []),
                ...parsedImageUrls.values,
              ].filter(Boolean),
            ),
          ]
        : [
            ...new Set(
              [
                oldProduct.imageUrl,
                ...oldImageUrlsParsed.values,
                ...(imageUrl ? [String(imageUrl)] : []),
                ...parsedImageUrls.values,
              ].filter(Boolean),
            ),
          ];
    const normalizedMainImage =
      (imageUrl ? String(imageUrl) : oldProduct.imageUrl) ||
      oldProduct.imageUrl;
    const additionalImageUrls = normalizedImageUrls.filter(
      (url) => url && url !== normalizedMainImage,
    );

    const { values: parsedCategoryIds, error: categoryIdsError } =
      parseStringArray(categoryIds, "categoryIds");
    if (categoryIdsError) {
      return res.status(400).json({ error: categoryIdsError });
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
      price: price !== undefined && price !== null && price !== ""
        ? Number(price)
        : oldProduct.price,
      unitMinQuantity: parsedPackagePrices.packagePrices.length === 0
        ? null
        : unitRange !== null ? unitRange.minQuantity : oldProduct.unitMinQuantity,
      unitMaxQuantity: parsedPackagePrices.packagePrices.length === 0
        ? null
        : unitRange !== null ? unitRange.maxQuantity : oldProduct.unitMaxQuantity,
      discount: discount ? parseFloat(discount) : (oldProduct.discount ?? null),
      minFlavors: flavorRange.minFlavors,
      maxFlavors: flavorRange.maxFlavors,
      gramsOptions: parsedGramsOptions.values.length
        ? JSON.stringify(parsedGramsOptions.values)
        : null,
      packagePrices: parsedPackagePrices.packagePrices.length
        ? JSON.stringify(parsedPackagePrices.packagePrices)
        : null,
      gramsPrices: parsedGramsPrices.packagePrices.length
        ? JSON.stringify(parsedGramsPrices.packagePrices)
        : null,
      active: active !== undefined ? active : oldProduct.active,
      imageUrl: normalizedMainImage,
      imageUrls: additionalImageUrls.length
        ? JSON.stringify(additionalImageUrls)
        : null,
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

    res.json(normalizeProductForResponse(product));
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
  res: Response,
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
      if (fileId) {
        await deleteFromDrive(fileId).catch((err) => {
          console.warn("Erro ao deletar imagem do Google Drive:", err.message);
        });
      }
    }

    const parsedImageUrls = parseStringArray(product.imageUrls, "imageUrls");
    if (!("error" in parsedImageUrls)) {
      for (const url of parsedImageUrls.values) {
        const fileId = url.split("id=")[1];
        if (!fileId) continue;
        await deleteFromDrive(fileId).catch((err) => {
          console.warn("Erro ao deletar imagem do Google Drive:", err.message);
        });
      }
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
