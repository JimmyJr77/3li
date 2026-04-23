-- Optional provenance for tasks created from Rapid Router / Mailroom flows.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "routingSource" TEXT;
