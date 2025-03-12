-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "packageSizes" TEXT,
ADD COLUMN     "sellingType" TEXT NOT NULL DEFAULT 'unit';
