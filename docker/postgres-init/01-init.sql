-- Set password for postgres user
ALTER USER postgres WITH PASSWORD 'postgres';

-- Create the database if it doesn't exist
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kpi_quest_v3') THEN
      CREATE DATABASE kpi_quest_v3;
   END IF;
END $$;
