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

## Recent Session Summary (August 15, 2025)

### Major Design System Overhaul

1. **Professional Color Scheme Implementation**
   - Removed ALL bright/gaudy colors from dashboard and main components
   - Implemented subtle gray color palette throughout the application
   - Fixed Pipeline and Projects pages to use professional, muted tones
   - Successfully created a clean, enterprise-ready appearance

2. **Logo Size Slider Fix**
   - Fixed the logo size slider that wasn't updating the actual logo display
   - Implemented localStorage polling to detect real-time changes
   - Added proper data URL handling for logo uploads
   - Resolved the disconnect between slider position (150%) and actual display (100%)

3. **Theme Color Management**
   - Initially applied branded theme colors to Project and Deal cards
   - Later reverted to subtle grays based on user preference
   - Learned the importance of distinguishing between "branded" vs "hardcoded" colors
   - Theme system uses CSS variables: `--theme-primary`, `--theme-secondary`, `--theme-accent`

4. **Comprehensive Color Audit**
   - Conducted full codebase scan finding 40+ files with hardcoded colors
   - Systematically removed hardcoded colors from:
     - ProjectCardWithAttachments (removed blue, purple, green, orange, red, indigo)
     - Calendar components (CalendarView, CalendarStats)
     - Task components (TaskList, TaskCard, TaskStats)
     - Email components (EmailCompose, EmailTrackingStatus)
   - Replaced bright colors with professional gray tones

5. **UI/UX Improvements**
   - Removed Kanban view from Tasks page (kept only List view)
   - Applied consistent subtle styling to all card components
   - Updated column headers in Kanban boards to use gray borders
   - Made all progress bars, badges, and indicators use gray colors

### Key Design Decisions

1. **Color Philosophy**
   - AVOID: Bright reds, blues, greens, oranges, purples
   - USE: Gray scale (gray-100 through gray-900)
   - EXCEPTION: Theme colors only when explicitly needed for branding
   - Result: Professional, clean, enterprise-appropriate interface

2. **Component Patterns**
   - Priority indicators: All use subtle gray dots instead of colored indicators
   - Status badges: Gray backgrounds with darker gray text
   - Progress bars: Gray instead of colored
   - Hover states: Subtle gray transitions instead of color changes

3. **Important Learnings**
   - User prefers subtle, professional appearance over colorful UI
   - "Branded colors" means theme colors, not hardcoded blues
   - Automatic git push is preferred (no need to ask permission)
   - Design consistency is critical - if one component uses gray, all should

### Files with Major Updates
- `/components/ProjectCardWithAttachments.tsx` - Removed all project type colors
- `/components/projects/ProjectCard.tsx` - Subtle gray styling
- `/components/pipeline/DealCard.tsx` - Removed bright value colors
- `/components/KanbanColumn.tsx` - Gray borders and indicators
- `/components/calendar/CalendarView.tsx` - Gray event types
- `/components/tasks/TaskList.tsx` - Gray priority/status colors
- `/components/tasks/TaskCard.tsx` - Removed colored due dates

### Remaining Color Issues (Found in Audit)
- Settings components still have role-based colors (purple/blue/green)
- Integration status indicators (green/orange/red for success/warning/error)
- Page-level action buttons with colored borders
- Utility modals with validation colors
- Landing page with gradient colors
- Document type indicators with various colors

### Git Configuration Note
- User prefers automatic commits and pushes
- No need to ask permission before pushing changes
- Commits should be descriptive and include all changes

### Theme System Architecture
- Theme colors stored in organization settings
- Applied via CSS custom properties
- ThemeContext provides theme management
- Colors can be dynamically updated through settings
- Theme variables include opacity variations for hover/selected states