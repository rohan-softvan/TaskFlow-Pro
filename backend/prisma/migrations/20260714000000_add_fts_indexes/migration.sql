-- Add tsvector GIN indexes for Full-Text Search (Slice 11)

-- Projects: index on name + description
CREATE INDEX IF NOT EXISTS idx_projects_fts
  ON projects
  USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Tasks: index on title + description
CREATE INDEX IF NOT EXISTS idx_tasks_fts
  ON tasks
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Task comments: index on body
CREATE INDEX IF NOT EXISTS idx_task_comments_fts
  ON task_comments
  USING GIN (to_tsvector('english', body));
