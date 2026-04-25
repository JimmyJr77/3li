-- Per-user, per-brand reusable ticket labels (colors + names), attachable to tasks alongside board labels.
CREATE TABLE "UserBrandTicketLabel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "color" VARCHAR(32) NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBrandTicketLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBrandTicketLabel_userId_brandId_name_key"
ON "UserBrandTicketLabel"("userId", "brandId", "name");

CREATE INDEX "UserBrandTicketLabel_brandId_idx" ON "UserBrandTicketLabel"("brandId");
CREATE INDEX "UserBrandTicketLabel_userId_brandId_idx" ON "UserBrandTicketLabel"("userId", "brandId");

ALTER TABLE "UserBrandTicketLabel"
ADD CONSTRAINT "UserBrandTicketLabel_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBrandTicketLabel"
ADD CONSTRAINT "UserBrandTicketLabel_brandId_fkey"
FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TaskUserBrandTicketLabel" (
    "taskId" TEXT NOT NULL,
    "userBrandTicketLabelId" TEXT NOT NULL,

    CONSTRAINT "TaskUserBrandTicketLabel_pkey" PRIMARY KEY ("taskId", "userBrandTicketLabelId")
);

CREATE INDEX "TaskUserBrandTicketLabel_userBrandTicketLabelId_idx"
ON "TaskUserBrandTicketLabel"("userBrandTicketLabelId");

ALTER TABLE "TaskUserBrandTicketLabel"
ADD CONSTRAINT "TaskUserBrandTicketLabel_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskUserBrandTicketLabel"
ADD CONSTRAINT "TaskUserBrandTicketLabel_userBrandTicketLabelId_fkey"
FOREIGN KEY ("userBrandTicketLabelId") REFERENCES "UserBrandTicketLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
