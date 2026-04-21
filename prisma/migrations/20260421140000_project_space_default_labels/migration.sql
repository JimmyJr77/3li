-- Align default TaskFoundry labels with Project Spaces / project boards naming.
UPDATE "Workspace" SET name = 'My Project' WHERE name = 'My workspace';
UPDATE "Board" SET name = 'Main project board' WHERE name = 'Main board';
