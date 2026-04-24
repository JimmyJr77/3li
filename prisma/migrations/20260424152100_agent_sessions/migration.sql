-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentKind" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "metadata" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentSession_workspaceId_agentKind_updatedAt_idx" ON "AgentSession"("workspaceId", "agentKind", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "AgentSessionEvent_sessionId_idx" ON "AgentSessionEvent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSessionEvent_sessionId_seq_key" ON "AgentSessionEvent"("sessionId", "seq");

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSessionEvent" ADD CONSTRAINT "AgentSessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
