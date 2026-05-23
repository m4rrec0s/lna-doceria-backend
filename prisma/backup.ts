import fs from "fs/promises";
import path from "path";
import { prisma } from "../src/utils/prismaClient";

type BackupData = {
  exportedAt: string;
  users: unknown[];
  categories: unknown[];
  flavors: unknown[];
  products: unknown[];
  displaySections: unknown[];
};

async function main() {
  const outputPath =
    process.env.BACKUP_OUTPUT || path.resolve(__dirname, "backup.json");

  const [users, categories, flavors, products, displaySections] =
    await Promise.all([
      prisma.user.findMany(),
      prisma.category.findMany(),
      prisma.flavor.findMany(),
      prisma.product.findMany({ include: { categories: true } }),
      prisma.displaySection.findMany(),
    ]);

  const productsPayload = products.map(({ categories, ...product }) => ({
    ...product,
    categoryIds: categories.map((category) => category.id),
  }));

  const payload: BackupData = {
    exportedAt: new Date().toISOString(),
    users,
    categories,
    flavors,
    products: productsPayload,
    displaySections,
  };

  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Backup salvo em ${outputPath}`);
}

main()
  .catch((error) => {
    console.error("Erro ao gerar backup do banco:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
