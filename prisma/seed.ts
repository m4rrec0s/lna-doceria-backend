import fs from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/utils/prismaClient";

type BackupProduct = Prisma.ProductUncheckedCreateInput & {
  categoryIds?: string[];
};

type BackupData = {
  exportedAt?: string;
  users: Prisma.UserUncheckedCreateInput[];
  categories: Prisma.CategoryUncheckedCreateInput[];
  flavors: Prisma.FlavorUncheckedCreateInput[];
  products: BackupProduct[];
  displaySections: Prisma.DisplaySectionUncheckedCreateInput[];
};

const toDate = (value?: string | Date | null) =>
  value ? new Date(value) : undefined;

async function main() {
  const inputPath =
    process.env.BACKUP_INPUT || path.resolve(__dirname, "backup.json");

  const raw = await fs.readFile(inputPath, "utf-8");
  const data = JSON.parse(raw) as BackupData;

  if (process.env.SEED_CLEAR === "true") {
    await prisma.displaySection.deleteMany();
    await prisma.flavor.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
  }

  if (data.users?.length) {
    await prisma.user.createMany({
      data: data.users,
      skipDuplicates: true,
    });
  }

  if (data.categories?.length) {
    await prisma.category.createMany({
      data: data.categories,
      skipDuplicates: true,
    });
  }

  if (data.flavors?.length) {
    await prisma.flavor.createMany({
      data: data.flavors,
      skipDuplicates: true,
    });
  }

  if (data.products?.length) {
    for (const product of data.products) {
      const { categoryIds, createdAt, updatedAt, ...rest } = product;
      await prisma.product.create({
        data: {
          ...rest,
          createdAt: toDate(createdAt),
          updatedAt: toDate(updatedAt),
          categories: categoryIds?.length
            ? { connect: categoryIds.map((id) => ({ id })) }
            : undefined,
        },
      });
    }
  }

  if (data.displaySections?.length) {
    await prisma.displaySection.createMany({
      data: data.displaySections.map((section) => ({
        ...section,
        startDate: toDate(section.startDate),
        endDate: toDate(section.endDate),
        createdAt: toDate(section.createdAt),
        updatedAt: toDate(section.updatedAt),
      })),
      skipDuplicates: true,
    });
  }

  console.log("Seed concluído com sucesso.");
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
