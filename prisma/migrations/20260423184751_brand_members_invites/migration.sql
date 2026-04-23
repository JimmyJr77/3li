-- CreateTable
CREATE TABLE "BrandMember" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandInvite" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandMember_userId_idx" ON "BrandMember"("userId");

-- CreateIndex
CREATE INDEX "BrandMember_brandId_idx" ON "BrandMember"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandMember_brandId_userId_key" ON "BrandMember"("brandId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandInvite_tokenHash_key" ON "BrandInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "BrandInvite_brandId_idx" ON "BrandInvite"("brandId");

-- CreateIndex
CREATE INDEX "BrandInvite_email_idx" ON "BrandInvite"("email");

-- AddForeignKey
ALTER TABLE "BrandMember" ADD CONSTRAINT "BrandMember_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMember" ADD CONSTRAINT "BrandMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMember" ADD CONSTRAINT "BrandMember_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandInvite" ADD CONSTRAINT "BrandInvite_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandInvite" ADD CONSTRAINT "BrandInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandInvite" ADD CONSTRAINT "BrandInvite_consumedByUserId_fkey" FOREIGN KEY ("consumedByUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
