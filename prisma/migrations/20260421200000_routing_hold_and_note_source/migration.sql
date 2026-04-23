-- Holding pen for unresolved captures; optional note provenance.
CREATE TABLE "RoutingHold" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "meta" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoutingHold_workspaceId_idx" ON "RoutingHold"("workspaceId");
CREATE INDEX "RoutingHold_workspaceId_status_idx" ON "RoutingHold"("workspaceId", "status");

ALTER TABLE "RoutingHold" ADD CONSTRAINT "RoutingHold_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "routingSource" TEXT;
