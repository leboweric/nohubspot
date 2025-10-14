# NHS (NotHubSpot) Architecture Documentation

## Overview
NHS is a customer relationship management (CRM) system built as a modern web application with a Next.js frontend and FastAPI backend. The application focuses on company management, contact tracking, pipeline deals, project management, and task organization with a clean, professional interface.

## Current Tech Stack

### Frontend
- **Framework**: Next.js 14.2.30 (React 18)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3.3.0
- **UI Components**: 
  - Custom components with Tailwind
  - Headless UI (@headlessui/react)
  - Radix UI primitives (@radix-ui)
  - Lucide React icons
- **State Management**: React hooks (useState, useEffect, useContext)
- **Data Fetching**: Custom API wrapper functions
- **Authentication**: Custom AuthGuard component with JWT tokens

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT-based authentication
- **Email Service**: SendGrid integration
- **AI Features**: OpenAI integration for summaries and assistance
- **File Storage**: Database-stored files with base64 encoding

### Infrastructure
- **Deployment**: Railway platform
- **Version Control**: GitHub
- **Database Migrations**: Alembic

## Application Architecture

### Directory Structure
```
nohubspot/
├── app/                    # Next.js app directory (pages)
│   ├── companies/         # Company management pages
│   ├── contacts/          # Contact management pages
│   ├── pipeline/          # Sales pipeline pages
│   ├── projects/          # Project management pages
│   ├── tasks/             # Task management pages
│   ├── calendar/          # Calendar views
│   ├── dashboard/         # Main dashboard
│   ├── settings/          # Configuration pages
│   └── auth/              # Authentication pages
├── components/            # Reusable React components
│   ├── ui/               # Generic UI components
│   ├── dashboard/        # Dashboard-specific components
│   ├── calendar/         # Calendar components
│   ├── email/           # Email-related components
│   ├── projects/        # Project-specific components
│   ├── pipeline/        # Pipeline-specific components
│   └── tasks/           # Task-specific components
├── lib/                  # Utility functions and API client
├── contexts/            # React context providers
├── backend/             # FastAPI backend
│   ├── models.py        # SQLAlchemy models
│   ├── crud.py          # Database operations
│   ├── main.py          # FastAPI app entry
│   ├── auth.py          # Authentication logic
│   └── migrations/      # SQL migration files
└── public/              # Static assets

```

## Current UI/UX Design

### Design System
1. **Color Scheme**
   - Professional gray-scale palette (gray-50 to gray-900)
   - Minimal use of colors (mainly grays for professional look)
   - Theme colors via CSS variables (--theme-primary, --theme-secondary, --theme-accent)
   - Branded colors can be customized per organization

2. **Typography**
   - System font stack with fallbacks
   - Consistent sizing with Tailwind's text utilities
   - Limited font weights (normal, medium, semibold, bold)

3. **Component Patterns**
   - Card-based layouts for data display
   - Modular components (CompanyCard, ContactCard, DealCard, ProjectCard)
   - Consistent hover states and transitions
   - Professional, muted styling throughout

4. **Layout**
   - Sidebar navigation (MainLayout component)
   - Responsive design with mobile considerations
   - Grid and list view toggles on main pages
   - Modal overlays for forms and details

### Current UI Strengths
- Clean, professional appearance
- Consistent component patterns
- Good information hierarchy
- Responsive layouts
- Fast performance with optimized queries

### Current UI Weaknesses
- Limited visual hierarchy (very flat design)
- Minimal use of visual cues and affordances
- Card layouts can feel repetitive
- Limited micro-interactions and animations
- No dark mode support
- Limited accessibility features
- Inconsistent spacing in some areas
- Forms could be more intuitive

## Key Features

### Core Modules
1. **Companies Management**
   - CRUD operations
   - Bulk upload via CSV
   - Advanced filtering and search
   - Export functionality (filtered and all)
   - Company cards with contact counts

2. **Contacts Management**
   - Contact profiles with company associations
   - Account team assignments
   - Communication tracking
   - Bulk operations

3. **Sales Pipeline**
   - Kanban board view
   - Deal stages and values
   - Drag-and-drop functionality
   - CSV export capabilities

4. **Projects Management**
   - Project cards with progress tracking
   - Team member assignments
   - File attachments
   - Stage management

5. **Tasks System**
   - List view with filtering
   - Priority and status management
   - Due date tracking
   - Assignment to users

6. **Calendar Integration**
   - Event scheduling
   - Company/contact associations
   - Visual calendar display

7. **Dashboard**
   - Metric cards (deals, projects, values)
   - Recent activity feed
   - Quick stats overview

### Supporting Features
- Email templates and tracking
- Document management with attachments
- Activity logging
- User management and permissions
- Organization settings and customization
- O365 integration (conditional features)

## Data Flow

### API Communication
1. Frontend makes requests via `/lib/api.ts` utility functions
2. Requests include JWT token in headers
3. Backend validates authentication
4. Database operations via SQLAlchemy ORM
5. JSON responses returned to frontend
6. Frontend updates UI based on response

### State Management
- Local component state for UI interactions
- Context providers for global state (theme, auth)
- No centralized state management library
- Direct API calls for data fetching
- Manual cache invalidation on updates

## Authentication & Security
- JWT-based authentication
- Token stored in localStorage
- AuthGuard component wraps protected routes
- Role-based permissions (admin, user)
- Organization-level data isolation

## Performance Considerations
- Pagination for large datasets
- Debounced search inputs
- Lazy loading for components
- Optimized bundle splitting with Next.js
- Database indexing for common queries

## Recent Improvements (from CLAUDE.md)
- Replaced all dropdowns with searchable components for scalability
- Fixed search input focus loss issues across platform
- Implemented soft delete patterns for data integrity
- Added comprehensive export functionality
- Enhanced activity tracking with specific entity names
- Professional gray-scale design system implementation

## Areas for Potential Improvement

### UI/UX Enhancements
1. **Visual Design**
   - Add subtle shadows and depth
   - Introduce accent colors strategically
   - Better visual feedback for interactions
   - More distinctive CTAs
   - Improved form layouts

2. **User Experience**
   - Add loading skeletons instead of spinners
   - Implement optimistic UI updates
   - Add keyboard shortcuts
   - Better error messages and validation
   - Guided onboarding flow

3. **Accessibility**
   - ARIA labels and roles
   - Keyboard navigation improvements
   - Screen reader compatibility
   - Color contrast verification
   - Focus management

### Technical Improvements
1. **State Management**
   - Consider Redux or Zustand for complex state
   - Implement proper caching strategy
   - Optimistic updates for better UX

2. **Performance**
   - Implement virtual scrolling for long lists
   - Add service worker for offline support
   - Image optimization and lazy loading
   - Code splitting improvements

3. **Developer Experience**
   - Add comprehensive testing suite
   - Implement Storybook for component development
   - Better TypeScript typing
   - API documentation with OpenAPI/Swagger

### Feature Enhancements
1. **Advanced Features**
   - Real-time collaboration
   - Advanced reporting and analytics
   - Workflow automation
   - Mobile app development
   - Advanced search with filters

2. **Integrations**
   - More email providers
   - Calendar sync (Google, Outlook)
   - Slack/Teams notifications
   - Zapier/webhook support

## Questions for Design Improvement

When seeking design recommendations, consider asking about:

1. **Visual Hierarchy**: How can we better guide users' attention to important elements?

2. **Information Architecture**: Is the current navigation and page structure optimal?

3. **Interaction Design**: What micro-interactions would improve the user experience?

4. **Responsive Design**: How can we better optimize for mobile and tablet experiences?

5. **Accessibility**: What specific improvements would make the app more accessible?

6. **Performance Perception**: How can we make the app feel faster even when load times are the same?

7. **Onboarding**: What would an ideal first-time user experience look like?

8. **Data Visualization**: How can we better present complex data and metrics?

9. **Consistency**: Where are we inconsistent in our design patterns?

10. **Modern Patterns**: What modern UI patterns could we adopt without losing our professional aesthetic?

## Design Principles to Consider

1. **Clarity over Cleverness**: Prioritize clear communication over fancy design
2. **Consistency**: Maintain patterns across all interfaces
3. **Feedback**: Always acknowledge user actions
4. **Progressive Disclosure**: Show only what's necessary when it's necessary
5. **Accessibility First**: Design for all users from the start
6. **Performance**: Design decisions should enhance, not hinder, performance
7. **Scalability**: Design systems that grow with the product

## Conclusion

NHS has a solid technical foundation with a clean, professional design. The main opportunities for improvement lie in:
- Adding more visual interest without sacrificing professionalism
- Improving user feedback and micro-interactions
- Enhancing accessibility and mobile experience
- Implementing more sophisticated state management
- Adding real-time features and advanced integrations

The application successfully serves its core CRM functions but could benefit from modern UI patterns and enhanced user experience features to compete with established CRM platforms.