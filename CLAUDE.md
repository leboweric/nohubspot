## Product Design Memories

- 1 is perfectly fine. I can see a situation where the Org has Sales Reps or Consultants or some other role that is the primary owner of a customers so we should just be able to select any user of NotHubSpot and assign it to the Company/Customer

## Recent Session Summary (July 27, 2025)

### Major Accomplishments

1. **Fixed Company Filter Dropdown**
   - Increased limit from 100 to 1000 companies to show all companies A-Z
   - Updated `loadCompanies` function in `/app/companies/page.tsx`

2. **Office 365 Conditional UI Elements**
   - Hide "Send Email" buttons when O365 is not connected
   - Hide Communication History, Email Engagement cards, and Emails Sent statistics
   - Fixed initialization error on contact detail pages (moved state declarations before useEffect)
   - Made Templates menu item conditional based on O365 connection status

3. **Export Functionality**
   - Added CSV export to Pipeline page (`/app/pipeline/page.tsx`)
   - Added CSV export to Projects page (`/app/projects/page.tsx`)
   - Both exports include comprehensive data fields with proper CSV escaping

4. **Dashboard Enhancements**
   - Added 5 metric cards: Active Deals, Pipeline Value, Active Projects, Project Value, Projected Hours
   - Replaced emoji icons with professional SVG icons
   - Removed AI Daily Summary
   - Reordered cards to show sales metrics before project metrics

5. **Modernized Dropdown Components**
   - Created new `ModernSelect` component using Headless UI (`/components/ui/ModernSelect.tsx`)
   - Replaced ALL native select elements throughout the app
   - Updated dropdowns in: Companies, Contacts, Tasks, Projects, Pipeline, DealModal, ProjectModal
   - Fixed missed dropdowns in ProjectModal (Primary Contact, Project Type, Stage) and Tasks page

6. **Branding Update**
   - Changed "NotHubSpot" to "NHS" throughout the app
   - Made NHS logo more prominent (text-3xl, bold, with hover effect)
   - Updated page metadata, login/register pages, landing page

7. **Recent Activity Enhancement**
   - Enhanced Recent Activity card to show specific entity names instead of generic terms
   - Implemented entity lookups for projects, deals, companies, and contacts
   - Added caching to improve performance
   - Example: "Moved 'Website Redesign' from Planning to In Progress" instead of "Moved project from Planning to In Progress"

8. **Bug Fixes**
   - Fixed DealModal to load 1000 companies instead of 100
   - Changed ProjectModal company field from autocomplete back to dropdown using ModernSelect

### Key Technical Patterns

- **Conditional Rendering**: Used O365 connection status to conditionally show/hide email-related features
- **Consistent UI/UX**: Implemented ModernSelect component for all dropdowns
- **Performance Optimization**: Added caching for entity lookups in Recent Activity
- **Error Handling**: Comprehensive try-catch blocks with user-friendly error messages
- **CSV Export**: Proper escaping and formatting for data exports

### File Structure Updates
- New component: `/components/ui/ModernSelect.tsx`
- Modified navigation: `/components/MainLayout.tsx`
- Enhanced dashboard: `/app/dashboard/page.tsx`
- Updated all form pages and modals to use ModernSelect

### Dependencies Added
- @headlessui/react (for ModernSelect component)