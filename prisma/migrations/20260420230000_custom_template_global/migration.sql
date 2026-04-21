-- AlterTable: custom templates may exist without a workspace (global / any-workspace)
ALTER TABLE "CustomBoardTemplate" DROP CONSTRAINT "CustomBoardTemplate_workspaceId_fkey";

ALTER TABLE "CustomBoardTemplate" ALTER COLUMN "workspaceId" DROP NOT NULL;

ALTER TABLE "CustomBoardTemplate" ADD CONSTRAINT "CustomBoardTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
