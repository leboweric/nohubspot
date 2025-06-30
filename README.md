# NotHubSpot CRM

> **The simple alternative to complex CRMs** 🎯

A modern, ultra-simple CRM built specifically for small and medium businesses. No bloat, just the essentials.

![NotHubSpot CRM](https://img.shields.io/badge/CRM-NotHubSpot-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen)

## ✨ **Why NotHubSpot?**

Traditional CRMs are **too complex** for SMBs. NotHubSpot focuses on what you actually need:

- 📇 **Contact Management** - Store and organize customer information
- 📧 **Email Tracking** - Know when emails are opened and clicked
- 📊 **Simple Analytics** - Basic metrics that matter
- 📱 **Mobile First** - Works perfectly on all devices
- 🏢 **Multi-Tenant** - Each business gets isolated data
- 🚀 **Fast & Simple** - No learning curve required

## 🎯 **Perfect For:**
- Small businesses (5-50 employees)
- Freelancers and consultants
- Service-based businesses
- Anyone frustrated with complex CRMs
- Teams that need something **today**, not next month

## 🚀 **Features**

### Core CRM Features
- ✅ **Contact Management** - Add, edit, search, and organize contacts
- ✅ **Email Integration** - Track email opens and clicks automatically
- ✅ **Bulk Import** - Import contacts from CSV/Excel files
- ✅ **Activity Timeline** - See all interactions with each contact
- ✅ **Search & Filter** - Find contacts instantly

### Business Features
- ✅ **Multi-Tenant** - Secure data isolation per company
- ✅ **User Management** - Team access with role-based permissions
- ✅ **Password Reset** - Secure password recovery system
- ✅ **Mobile Responsive** - Perfect experience on all devices
- ✅ **Real-time Updates** - See changes instantly

### Technical Features
- ✅ **Modern Stack** - React + Flask + PostgreSQL
- ✅ **Secure** - JWT authentication, password hashing, CORS protection
- ✅ **Scalable** - Built to grow with your business
- ✅ **Fast** - Optimized for performance
- ✅ **Reliable** - Production-ready architecture

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │   Flask Backend │    │   PostgreSQL    │
│   (Netlify)     │◄──►│   (Railway)     │◄──►│   Database      │
│                 │    │                 │    │   (Railway)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

- **Frontend**: React with Tailwind CSS (ultra-clean design)
- **Backend**: Flask API with JWT authentication
- **Database**: PostgreSQL with multi-tenant architecture
- **Deployment**: Netlify (frontend) + Railway (backend)

## 📊 **Screenshots**

### Dashboard
Clean overview of your CRM metrics and recent activity.

### Contact Management
Simple, intuitive contact management with search and filtering.

### Email Tracking
See when your emails are opened and clicked.

## 🚀 **Quick Start**

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/nothubspot-crm.git
cd nothubspot-crm
```

### 2. Deploy Backend (Railway)
- Create Railway account
- Connect GitHub repository
- Add PostgreSQL service
- Set environment variables
- Deploy automatically

### 3. Deploy Frontend (Netlify)
- Create Netlify account
- Connect GitHub repository
- Set environment variables
- Deploy automatically

**Detailed instructions**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## 💰 **Pricing**

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | Netlify | **Free** |
| Backend + Database | Railway | **~$5/month** |
| Domain (optional) | Your registrar | **~$12/year** |
| **Total** | | **~$5-8/month** |

**Compare to HubSpot**: $45-1,200/month 💸

## 🔧 **Local Development**

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python src/main.py
```

### Frontend
```bash
cd frontend
pnpm install
cp .env.example .env
pnpm run dev
```

Visit `http://localhost:5173` to see the app.

## 🤝 **Contributing**

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 **Support**

- 📖 **Documentation**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/yourusername/nothubspot-crm/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/nothubspot-crm/discussions)

## 🎯 **Roadmap**

### Phase 1 (Current)
- [x] Contact management
- [x] Email tracking
- [x] Bulk import
- [x] Multi-tenant architecture
- [x] Password reset

### Phase 2 (Next)
- [ ] Email templates
- [ ] Basic reporting
- [ ] API webhooks
- [ ] Mobile app
- [ ] Integrations (Zapier, etc.)

### Phase 3 (Future)
- [ ] Advanced analytics
- [ ] Team collaboration
- [ ] Custom fields
- [ ] Workflow automation
- [ ] White-label options

## 🏆 **Why Choose NotHubSpot?**

| Feature | NotHubSpot | HubSpot | Salesforce |
|---------|------------|---------|------------|
| **Setup Time** | 5 minutes | 2-4 weeks | 1-3 months |
| **Learning Curve** | None | Steep | Very steep |
| **Monthly Cost** | $5 | $45-1,200 | $25-300 |
| **Complexity** | Simple | Complex | Very complex |
| **SMB Focus** | ✅ Yes | ❌ Enterprise | ❌ Enterprise |

---

**Built with ❤️ for small businesses who need CRM that just works.**

*NotHubSpot - Because your CRM shouldn't be harder than your business.* 🎯

