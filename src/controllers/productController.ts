import { Request, Response } from "express";
import { prisma } from "../utils/prismaClient";
import { deleteFromDrive, uploadToDrive } from "../config/googleDriveConfig";

export const createProduct = async (req: Request, res: Response) => {
  const { name, description, price, categoryId, discount, imageUrl } = req.body;
  const discountValue = discount ? parseFloat(discount) : 0;
  const product = await prisma.product.create({
    data: {
      name,
      description,
      price: parseFloat(price),
      imageUrl,
      categoryId,
      discount: discountValue,
    },
  });
  res.status(201).json(product);
};

export const getProducts = async (req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    include: { category: true },
  });
  res.json(products);
};

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const oldProduct = await prisma.product.findUnique({ where: { id } });
  if (!oldProduct) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }

  const { name, description, price, categoryId, discount, imageUrl } = req.body;
  const updateData: any = {
    name: name ?? oldProduct.name,
    description: description ?? oldProduct.description,
    price: price ? parseFloat(price) : oldProduct.price,
    categoryId: categoryId ?? oldProduct.categoryId,
    discount: discount ? parseFloat(discount) : oldProduct.discount ?? 0,
  };

  if (imageUrl) {
    updateData.imageUrl = imageUrl;
  }

  const product = await prisma.product.update({
    where: { id },
    data: updateData,
  });
  res.json(product);
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
