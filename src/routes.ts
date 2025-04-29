import { Router } from "express";
import { registerController } from "./controllers/registerController";
import loginController from "./controllers/loginController";
import {
  createProduct,
  getProducts,
  deleteProduct,
  updateProduct,
  // getActiveProducts,
  // getInactiveProducts,
} from "./controllers/productController";
import { upload } from "./config/multer";
import { uploadToDrive, deleteFromDrive } from "./config/googleDriveConfig";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
} from "./controllers/categoryController";
import {
  createFlavor,
  getFlavors,
  getFlavorById,
  updateFlavor,
  deleteFlavor,
  getFlavorsByCategoryId,
} from "./controllers/flavorController";
import {
  getDisplaySettings,
  createDisplaySection,
  updateDisplaySection,
  deleteDisplaySection,
  updateAllDisplaySections,
} from "./controllers/displaySettingsController";
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
routes.post("/display-sections", createDisplaySection);
routes.post("/flavors", upload.single("image"), async (req, res) => {
  try {
    if (req.file) {
      req.body.imageUrl = await uploadToDrive(req.file);
    }
    await createFlavor(req, res);
  } catch (error) {
    console.error("Erro na rota de criação de sabor:", error);
    res.status(500).json({ error: "Erro ao processar upload" });
  }
});

// gets
routes.get("/products", getProducts);
// routes.get("/products/inactive", getInactiveProducts);
routes.get("/categories", getCategories);
routes.get("/categories/:id", getCategoryById);
routes.get("/display-settings", getDisplaySettings);
routes.get("/flavors", getFlavors);
routes.get("/flavors/:id", getFlavorById);
routes.get("/categories/:categoryId/flavors", getFlavorsByCategoryId);

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
routes.put("/flavors/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const oldFlavor = await prisma.flavor.findUnique({ where: { id } });

    if (req.file) {
      if (oldFlavor?.imageUrl) {
        const fileId = oldFlavor.imageUrl.split("id=")[1];
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
    await updateFlavor(req, res);
  } catch (error) {
    console.error("Erro na rota de atualização de sabor:", error);
    res.status(500).json({ error: "Erro ao processar upload" });
  }
});
routes.put("/display-sections/:id", updateDisplaySection);
routes.put("/display-sections", updateAllDisplaySections);

// deletes
routes.delete("/categories/:id", deleteCategory);
routes.delete("/products/:id", deleteProduct);
routes.delete("/flavors/:id", deleteFlavor);
routes.delete("/display-sections/:id", deleteDisplaySection);
