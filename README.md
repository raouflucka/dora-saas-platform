# DORA SaaS Platform

Enterprise-grade SaaS architecture for the DORA (Digital Operational Resilience Act) risk analysis platform.

## Tech Stack
- **Backend:** NestJS, TypeScript, PostgreSQL, Prisma ORM, JWT, class-validator
- **Frontend:** React, Vite, TypeScript, TailwindCSS, Shadcn UI, Zustand, React Query

## Requirements
- Node.js (v22+)
- Docker & Docker Compose

## Development Setup

1. **Environment Variables**
   ```bash
   cp .env.example .env
   ```
   Note: The `.env` variables dictate your local setup or the Docker Compose setup.

2. **Docker Compose (Recommended)**
   To quickly spin up the `PostgreSQL` database, `Backend` (Node), and `Frontend` (Vite dev server) together:
   ```bash
   docker-compose up --build
   ```
   - The frontend will be available at `http://localhost:5173`
   - The backend API will be available at `http://localhost:3000`
   - Swagger documentation available at `http://localhost:3000/api/docs`

3. **Manual Development Mode (Without Docker for Node services)**
   Ensure Docker is running a local Postgres container (or use your own PostgreSQL server):
   ```bash
   docker-compose up postgres -d
   ```

   **Backend:**
   ```bash
   cd backend
   npm install
   npx prisma db push
   npx prisma generate
   npm run start:dev
   ```

   **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Folder Structure
- `/backend`: NestJS source code, Prisma schema, API logic, Authentication guard rails
- `/frontend`: React application, Tailwind/Shadcn configurations, routing, and Zustand state

## Best Practices
- Keep components modular.
- Avoid committing secrets or `.env` to source control.
- Validate all incoming DTOs over the backend.
