-- CreateTable
CREATE TABLE "Flavor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "categoryId" TEXT,

    CONSTRAINT "Flavor_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Flavor" ADD CONSTRAINT "Flavor_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
