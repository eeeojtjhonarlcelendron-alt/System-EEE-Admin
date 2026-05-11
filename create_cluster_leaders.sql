-- Create cluster_leaders table if it doesn't exist
CREATE TABLE IF NOT EXISTS cluster_leaders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_name TEXT NOT NULL,
  hubs TEXT[], -- Array of hub names
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some sample data if table is empty
INSERT INTO cluster_leaders (leader_name, hubs) 
SELECT 
  'John Doe', 
  ARRAY['Hub A', 'Hub B']
WHERE NOT EXISTS (SELECT 1 FROM cluster_leaders);

INSERT INTO cluster_leaders (leader_name, hubs) 
SELECT 
  'Jane Smith', 
  ARRAY['Hub C', 'Hub D', 'Hub E']
WHERE (SELECT COUNT(*) FROM cluster_leaders) = 1;

-- Grant permissions
GRANT ALL ON cluster_leaders TO anon;
GRANT ALL ON cluster_leaders TO authenticated;
