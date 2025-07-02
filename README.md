# NoHubSpot CRM

A complete CRM system - the HubSpot alternative.

## 🏗️ Architecture

- **Frontend**: Next.js app → Deploy to Netlify
- **Backend**: FastAPI app → Deploy to Railway with PostgreSQL

## 🚀 Quick Start

### Frontend Development
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

### Backend Development  
\`\`\`bash
cd backend
pip install -r requirements.txt
python main.py
\`\`\`

## 📦 Deployment

### Netlify (Frontend)
- **Build command**: `cd frontend && npm run build`
- **Publish directory**: `frontend/.next`
- **Base directory**: `frontend`

### Railway (Backend)
- **Root directory**: `backend`
- Railway auto-detects Python and uses `railway.json`
- PostgreSQL database: `switchback.proxy.rlwy.net:27597`

## 🔧 Environment Variables

### Frontend (.env.local)
\`\`\`
NEXT_PUBLIC_API_URL=https://nohubspot-production.up.railway.app
\`\`\`

### Backend (Railway - Auto-configured)
\`\`\`
DATABASE_URL=postgresql://... (provided by Railway)
PORT=8080
\`\`\`

## ✨ Features

- 🏢 Company Management
- 👥 Contact Management  
- 📧 Email Threading
- 📎 File Attachments
- 📊 Dashboard Analytics
- 🔍 Search & Filtering
- 📱 Responsive Design

## 🛠️ Tech Stack

**Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
**Backend**: FastAPI, SQLAlchemy, PostgreSQL, Pydantic
**Deployment**: Netlify + Railway
