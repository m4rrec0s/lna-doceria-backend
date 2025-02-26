import { Router } from "express";
import { registerController } from "./controllers/registerController";
import loginController from "./controllers/loginController";
import {
  createProduct,
  getProducts,
  deleteProduct,
  updateProduct,
} from "./controllers/productController";
import { upload } from "./config/multer";
import { uploadToDrive, deleteFromDrive } from "./config/googleDriveConfig";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
} from "./controllers/categoryController";
import { prisma } from "./utils/prismaClient";

export const routes = Router();

// posts
routes.post("/login", loginController);
routes.post("/register", registerController);
routes.post("/products", upload.single("image"), async (req, res) => {
  try {
    if (req.file) {
      req.body.imageUrl = await uploadToDrive(req.file);
    }
    await createProduct(req, res);
  } catch (error) {
    console.error("Erro na rota de criação de produto:", error);
    res.status(500).json({ error: "Erro ao processar upload" });
  }
});
routes.post("/categories", createCategory);

// gets
routes.get("/products", getProducts);
routes.get("/categories", getCategories);

// puts
routes.put("/categories/:id", updateCategory);
routes.put("/products/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const oldProduct = await prisma.product.findUnique({ where: { id } });

    if (req.file) {
      if (oldProduct?.imageUrl) {
        const fileId = oldProduct.imageUrl.split("id=")[1];
        try {
          await deleteFromDrive(fileId);
        } catch (error: any) {
          if (error.response?.status === 404) {
            console.warn("Imagem antiga não encontrada, ignorando exclusão");
          } else {
            throw error;
          }
        }
      }
      req.body.imageUrl = await uploadToDrive(req.file);
    }
    await updateProduct(req, res);
  } catch (error) {
    console.error("Erro na rota de atualização de produto:", error);
    res.status(500).json({ error: "Erro ao processar upload" });
  }
});

// deletes
routes.delete("/categories/:id", deleteCategory);
routes.delete("/products/:id", deleteProduct);
