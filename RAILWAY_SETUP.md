# Railway Setup Guide for NotHubSpot CRM

## 🚂 **Step-by-Step Railway Deployment**

### 1. **Prepare Your Repository**
```bash
# Upload the project to GitHub
git init
git add .
git commit -m "Initial NotHubSpot CRM commit"
git remote add origin https://github.com/yourusername/nothubspot-crm.git
git push -u origin main
```

### 2. **Create Railway Project**
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `nothubspot-crm` repository

### 3. **Configure Backend Service**
1. Railway will detect the backend automatically
2. **Root Directory**: Set to `backend`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `python src/main.py`

### 4. **Add PostgreSQL Database**
1. In your Railway project dashboard
2. Click "New Service" → "Database" → "PostgreSQL"
3. Railway automatically sets `DATABASE_URL` environment variable

### 5. **Set Environment Variables**
In Railway dashboard → Backend service → Variables:

```bash
# Required Variables
JWT_SECRET_KEY=your-super-secure-random-key-here
FLASK_ENV=production
CORS_ORIGINS=https://your-netlify-app.netlify.app

# Optional (Railway sets these automatically)
DATABASE_URL=postgresql://... (auto-set by Railway)
PORT=8000 (auto-set by Railway)
```

**Generate JWT Secret:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 6. **Deploy Backend**
- Railway will automatically deploy when you push to GitHub
- Your backend URL: `https://your-project-name.railway.app`
- Check deployment logs for any issues

### 7. **Test Backend**
```bash
curl https://your-project-name.railway.app/api/health
# Should return: {"success": true, "message": "CRM API is running"}
```

## 🌐 **Netlify Frontend Setup**

### 1. **Deploy Frontend**
1. Go to [netlify.com](https://netlify.com)
2. "New site from Git" → Select your repository
3. **Base directory**: `frontend`
4. **Build command**: `pnpm run build`
5. **Publish directory**: `dist`

### 2. **Set Environment Variables**
In Netlify → Site settings → Environment variables:
```bash
VITE_API_URL=https://your-railway-project.railway.app/api
```

### 3. **Update CORS**
Back in Railway, update the CORS_ORIGINS variable:
```bash
CORS_ORIGINS=https://your-netlify-app.netlify.app
```

## ✅ **Verification Checklist**

- [ ] Backend deploys successfully on Railway
- [ ] PostgreSQL database is connected
- [ ] Environment variables are set
- [ ] Health check endpoint works
- [ ] Frontend deploys on Netlify
- [ ] Frontend can connect to backend API
- [ ] Registration/login works
- [ ] Contact creation works
- [ ] Bulk import works

## 💰 **Expected Costs**
- **Railway**: ~$5/month (includes PostgreSQL)
- **Netlify**: Free
- **Total**: ~$5/month

## 🔧 **Troubleshooting**

### Common Issues:

**1. Build Failures**
- Check Python version (should be 3.11+)
- Verify requirements.txt is complete
- Check Railway build logs

**2. Database Connection Errors**
- Ensure PostgreSQL service is running
- Check DATABASE_URL is set correctly
- Verify database tables are created

**3. CORS Errors**
- Update CORS_ORIGINS with exact Netlify URL
- Don't include trailing slashes
- Redeploy after changing environment variables

**4. 404 Errors on Frontend**
- Ensure netlify.toml redirects are configured
- Check build output directory is `dist`

### Getting Help:
- Railway logs: Project dashboard → Service → Logs
- Netlify logs: Site dashboard → Deploys → Deploy log
- Test API endpoints directly with curl

## 🚀 **You're Done!**

Your NotHubSpot CRM should now be live at:
- **Frontend**: `https://your-app.netlify.app`
- **Backend**: `https://your-project.railway.app`

**Next Steps:**
1. Set up your custom domain (optional)
2. Create your first admin account
3. Start adding contacts!

---
*NotHubSpot CRM - Simple CRM that just works* 🎯

