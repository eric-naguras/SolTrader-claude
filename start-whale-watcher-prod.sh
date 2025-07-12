#!/bin/bash

# Load environment variables
export SUPABASE_URL=https://jjbnwdfcavzszjszuumw.supabase.co
export SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqYm53ZGZjYXZ6c3pqc3p1dW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NDk0NDAsImV4cCI6MjA2NzUyNTQ0MH0.JbAY4FryOHRQH-_aXeFN-4QDnbaMO4ER3F3fX2nV2bM
export HELIUS_API_KEY=34dbddc0-3bb7-469e-ae51-7fee68db42fd

# Start the whale watcher service in production mode
cd apps/whale-watcher && npm start