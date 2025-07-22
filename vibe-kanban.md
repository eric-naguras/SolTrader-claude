## Setup and DevServer commands

### Setup
cd backend
bun install
export DATABASE_URL='postgresql://neondb_owner:npg_aVGRyTA69KnJ@ep-silent-sun-a1wh06rq-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
export HELIUS_API_KEY='34dbddc0-3bb7-469e-ae51-7fee68db42fd'
export SOLSCAN_API_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NTI1NTA5OTY4NzIsImVtYWlsIjoiZXJpY0BuYWd1cmFzLmNvbSIsImFjdGlvbiI6InRva2VuLWFwaSIsImFwaVZlcnNpb24iOiJ2MiIsImlhdCI6MTc1MjU1MDk5Nn0.b7QyzQKxEDF-dlUsvE4E0mWnbkD4TEffJGcwl68XrHM'

### Dev Server
export DATABASE_URL='postgresql://neondb_owner:npg_aVGRyTA69KnJ@ep-silent-sun-a1wh06rq-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
export HELIUS_API_KEY='34dbddc0-3bb7-469e-ae51-7fee68db42fd'
export SOLSCAN_API_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NTI1NTA5OTY4NzIsImVtYWlsIjoiZXJpY0BuYWd1cmFzLmNvbSIsImFjdGlvbiI6InRva2VuLWFwaSIsImFwaVZlcnNpb24iOiJ2MiIsImlhdCI6MTc1MjU1MDk5Nn0.b7QyzQKxEDF-dlUsvE4E0mWnbkD4TEffJGcwl68XrHM'
cd frontend
bun run dev