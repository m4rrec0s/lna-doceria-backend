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
} from "./controllers/categoryController";

export const routes = Router();

// posts
routes.post("/login", loginController);
routes.post("/register", registerController);
routes.post("/products", upload.single("image"), async (req, res) => {
  req.body.imageUrl = req.file ? await uploadToDrive(req.file) : "";
  createProduct(req, res);
});
routes.post("/categories", createCategory);

// gets
routes.get("/products", getProducts);

// puts
routes.put("/categories/:id", updateCategory);
routes.put("/products/:id", upload.single("image"), async (req, res) => {
  if (req.file) {
    const { id } = req.params;
    const { deleteFromDrive } = await import("./config/googleDriveConfig");
    const { prisma } = await import("./utils/prismaClient");
    const oldProduct = await prisma.product.findUnique({ where: { id } });
    if (oldProduct?.imageUrl) {
      const fileId = oldProduct.imageUrl.split("id=")[1];
      try {
        await deleteFromDrive(fileId);
      } catch (error: any) {
        if (error.response && error.response.status === 404) {
          console.warn("Imagem antiga não encontrada, ignorando exclusão");
        } else {
          throw error;
        }
      }
    }
    req.body.imageUrl = await uploadToDrive(req.file);
  }
  updateProduct(req, res);
});

// deletes
routes.delete("/categories/:id", deleteCategory);
routes.delete("/products/:id", deleteProduct);
