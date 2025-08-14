# Unified Design System
## Building a Cohesive Product Suite Look & Feel

This document captures the essential visual DNA that creates the distinctive "feel" of our product suite. Every product built using this system will feel like part of the same family.

---

## 🎨 The Core Visual DNA

### The Signature "Feel"
Our products have a **refined, professional, and breathable** aesthetic characterized by:

1. **Subtle Depth** - Minimal shadows that provide just enough elevation
2. **Soft Boundaries** - Consistent border radius creating friendly, approachable interfaces
3. **Generous Breathing Room** - Ample whitespace that never feels cramped
4. **Quiet Interactions** - Smooth, understated transitions that feel premium
5. **Consistent Rhythm** - Predictable spacing and sizing that creates visual harmony

---

## 🎭 The Five Pillars of Our Visual Identity

### 1. Shadow & Elevation System
Our products use a **restrained shadow system** that creates subtle depth without heavy drop shadows:

```css
/* The Shadow Scale - Less is More */
.shadow-xs { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }    /* Inputs, buttons */
.shadow-sm { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1); }     /* Cards, default */
.shadow-md { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }  /* Hover states */
.shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); } /* Modals, dropdowns */
```

**Key Principle**: Most UI elements use `shadow-sm` or less. Heavy shadows are reserved for overlays.

### 2. Border & Radius Language
```css
/* The Cornerstone Radius */
--radius: 0.625rem; /* 10px - The golden radius for all elements */

/* Radius Variations */
--radius-sm: calc(var(--radius) - 4px);  /* 6px - Badges, small elements */
--radius-md: calc(var(--radius) - 2px);  /* 8px - Inputs, buttons */
--radius-lg: var(--radius);              /* 10px - Cards, containers */
--radius-xl: calc(var(--radius) + 4px);  /* 14px - Large modals */

/* Border Style */
border: 1px solid var(--border); /* Always 1px, never thicker */
```

**Key Principle**: The 10px radius is our signature. It's soft enough to be friendly, sharp enough to be professional.

### 3. The Focus Ring System
Our unique focus state creates a **glowing ring** effect that's both accessible and beautiful:

```css
/* The Signature Focus Ring */
.focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px rgb(var(--ring) / 0.5);
  outline: none;
}

/* Smooth transition for focus */
transition: color 200ms, box-shadow 200ms;
```

**Key Principle**: Focus states are obvious but not jarring. The semi-transparent ring creates a gentle glow.

### 4. Color Application Philosophy

#### The Neutral Foundation
```css
/* Light Mode Base */
--background: white;
--foreground: very-dark-gray;
--muted: light-gray;
--border: very-light-gray;

/* Dark Mode Base */
--background: almost-black;
--foreground: almost-white;
--muted: dark-gray;
--border: rgba(255, 255, 255, 0.1);
```

#### Semantic Color Usage
- **Primary**: Reserved for primary actions and active states
- **Muted**: Backgrounds for secondary information
- **Border**: Subtle dividers that don't dominate
- **Destructive**: Used sparingly, only for delete/remove actions

#### The "Quiet Confidence" Principle
Colors are **never shouty**. Even our primary actions are confident but not aggressive:
- No pure black (#000) or pure white (#FFF) in the palette
- Destructive actions use muted reds, not alarm reds
- Success states use gentle greens, not neon

---

## 🎨 Branded Color System Architecture

### Overview
Our branded color system allows organizations to customize their interface colors while maintaining design consistency. This system enables white-label flexibility without sacrificing the unified design language.

### Core Architecture

#### 1. Three-Color System
Each organization defines three brand colors:
```javascript
{
  primary: '#3B82F6',    // Main brand color - CTAs, headers, active states
  secondary: '#1E40AF',  // Darker variant - hover states, emphasis
  accent: '#60A5FA'      // Lighter variant - backgrounds, highlights
}
```

#### 2. Database Storage
Colors are stored at the organization level:
```sql
-- organizations table columns
theme_primary_color VARCHAR(7) DEFAULT '#3B82F6'
theme_secondary_color VARCHAR(7) DEFAULT '#1E40AF'
theme_accent_color VARCHAR(7) DEFAULT '#60A5FA'
```

#### 3. Preset Themes
Eight carefully curated preset themes provide quick setup:
- **Blue (Default)** - Trust, stability
- **Orange (Vibrant)** - Energy, creativity
- **Green (Growth)** - Success, progress
- **Purple (Professional)** - Premium, sophisticated
- **Red (Energy)** - Urgency, action
- **Teal (Modern)** - Fresh, innovative
- **Gray (Neutral)** - Minimal, focused
- **Indigo (Trust)** - Reliable, corporate

### Implementation Pattern

#### Frontend Architecture

##### 1. Theme Fetching & Caching
```javascript
// On application load or organization switch
const fetchOrganizationTheme = async () => {
  const response = await organizationService.getOrganization();
  const theme = {
    primary: response.theme_primary_color || '#3B82F6',
    secondary: response.theme_secondary_color || '#1E40AF',
    accent: response.theme_accent_color || '#60A5FA'
  };
  
  // Cache in localStorage for performance
  saveOrgTheme(orgId, theme);
  setThemeColors(theme);
};
```

##### 2. Local Storage Management
```javascript
// Organization-specific theme storage
const getThemeStorageKey = (orgId) => `orgTheme_${orgId}`;

// Save theme locally for instant loading
const saveOrgTheme = (orgId, theme) => {
  localStorage.setItem(getThemeStorageKey(orgId), JSON.stringify(theme));
};

// Retrieve cached theme
const getOrgTheme = (orgId) => {
  const saved = localStorage.getItem(getThemeStorageKey(orgId));
  return saved ? JSON.parse(saved) : null;
};
```

##### 3. Component-Level Application
```javascript
// Dynamic style application
<div style={{ 
  backgroundColor: themeColors.primary,
  borderColor: themeColors.secondary 
}}>
  
// Alpha channel variations
<div style={{ 
  backgroundColor: `${themeColors.accent}20`, // 20% opacity
  border: `1px solid ${themeColors.primary}40` // 40% opacity
}}>

// Hover states
onMouseEnter={(e) => e.target.style.backgroundColor = `${themeColors.primary}15`}
onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
```

##### 4. Color Application Patterns

###### Primary Color Uses:
- Primary buttons and CTAs
- Active navigation items
- Headers and section titles
- Progress indicators
- Focus rings
- Success states
- Links and interactive text

###### Secondary Color Uses:
- Hover states for primary elements
- Emphasis text
- Secondary headers
- Border accents
- Active tab indicators
- Selected items

###### Accent Color Uses:
- Subtle backgrounds
- Hover backgrounds (with low opacity)
- Badge backgrounds
- Info alerts
- Highlight areas
- Card headers (with very low opacity)

### Color Utility Functions

```javascript
// Convert hex to RGBA for opacity control
export const hexToRgba = (hex, opacity) => {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Common opacity patterns
const colorPatterns = {
  hover: (color) => `${color}15`,        // 15% for hover backgrounds
  selected: (color) => `${color}20`,     // 20% for selected states
  background: (color) => `${color}10`,   // 10% for subtle backgrounds
  border: (color) => `${color}40`,       // 40% for borders
  disabled: (color) => `${color}50`      // 50% for disabled states
};
```

### Backend Implementation

#### API Endpoints
```javascript
// GET /api/v1/organizations/:id
// Returns organization with theme colors
{
  id: "...",
  name: "...",
  theme_primary_color: "#FB923C",
  theme_secondary_color: "#C2410C",
  theme_accent_color: "#FED7AA"
}

// PUT /api/v1/organizations/:id/theme
// Updates organization theme
{
  primary: "#FB923C",
  secondary: "#C2410C",
  accent: "#FED7AA"
}
```

### ColorThemePicker Component

The ColorThemePicker provides a user-friendly interface for theme customization:

#### Features:
1. **Live Preview** - Real-time color preview
2. **Preset Selection** - Quick selection from 8 presets
3. **Custom Colors** - Full hex color picker
4. **Validation** - Ensures valid hex codes
5. **Persistence** - Saves to database and localStorage

#### Component Usage:
```jsx
<ColorThemePicker
  currentTheme={themeColors}
  onThemeChange={handleThemeChange}
  onSave={saveTheme}
  saving={saving}
/>
```

### Best Practices

#### 1. Contrast Ratios
- Ensure primary colors meet WCAG AA standards against white backgrounds
- Test secondary colors for readability on light backgrounds
- Verify accent colors work with overlaid text

#### 2. Color Consistency
- Use the same opacity patterns throughout the app
- Apply colors consistently to similar UI elements
- Maintain the color hierarchy (primary > secondary > accent)

#### 3. Performance Optimization
- Cache themes in localStorage to prevent flashing
- Load theme before rendering UI components
- Use CSS variables for frequently used colors

#### 4. Fallback Strategy
```javascript
const defaultTheme = {
  primary: '#3B82F6',
  secondary: '#1E40AF', 
  accent: '#60A5FA'
};

const getTheme = () => {
  return cachedTheme || fetchedTheme || defaultTheme;
};
```

### Migration Guide for Other Products

#### Step 1: Database Setup
```sql
ALTER TABLE organizations
ADD COLUMN theme_primary_color VARCHAR(7) DEFAULT '#3B82F6',
ADD COLUMN theme_secondary_color VARCHAR(7) DEFAULT '#1E40AF',
ADD COLUMN theme_accent_color VARCHAR(7) DEFAULT '#60A5FA';
```

#### Step 2: API Implementation
1. Add theme fields to organization GET endpoint
2. Create PUT endpoint for theme updates
3. Add validation for hex color format

#### Step 3: Frontend Integration
1. Create theme context/store
2. Implement theme fetching on app load
3. Add localStorage caching
4. Create ColorThemePicker component
5. Apply colors throughout components

#### Step 4: Testing
1. Test theme persistence across sessions
2. Verify theme isolation between organizations
3. Check color accessibility
4. Test preset theme application
5. Validate custom color input

### Common Implementation Patterns

#### Pattern 1: Status Indicators
```javascript
// Success with brand color
<div style={{ 
  backgroundColor: `${themeColors.primary}10`,
  borderLeft: `3px solid ${themeColors.primary}` 
}}>
```

#### Pattern 2: Interactive Elements
```javascript
// Button with theme colors
<button
  style={{
    backgroundColor: themeColors.primary,
    color: 'white'
  }}
  onMouseEnter={(e) => e.target.style.backgroundColor = themeColors.secondary}
  onMouseLeave={(e) => e.target.style.backgroundColor = themeColors.primary}
>
```

#### Pattern 3: Data Visualization
```javascript
// Charts using theme colors
const chartColors = [
  themeColors.primary,
  themeColors.secondary,
  themeColors.accent,
  hexToRgba(themeColors.primary, 0.6),
  hexToRgba(themeColors.secondary, 0.6)
];
```

### Troubleshooting

#### Issue: Theme not persisting
- Check localStorage key naming
- Verify organization ID is available
- Ensure save endpoint is called

#### Issue: Colors flashing on load
- Load theme before component render
- Use suspense or loading states
- Apply default theme immediately

#### Issue: Poor contrast
- Validate color choices against WCAG
- Provide contrast warnings in picker
- Suggest accessible alternatives

### 5. Animation & Micro-interactions

#### The Timing Function
```css
/* Our signature easing */
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
transition-duration: 200ms; /* Fast but perceivable */
```

#### Interaction Patterns
```css
/* Hover Lift - subtle elevation on hover */
.hover-lift {
  transition: transform 200ms, box-shadow 200ms;
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* Gentle Pulse - for loading or active states */
@keyframes gentle-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

/* Smooth Collapse - for accordions */
.collapse-transition {
  transition: height 200ms ease-out;
}
```

**Key Principle**: Animations should feel like the UI is breathing, not jumping.

---

## 📐 The Spacing Symphony

### The 8-Point Grid
Everything aligns to an **8px base unit**, creating visual rhythm:

```css
/* Spacing Scale */
space-0: 0px
space-1: 4px   /* Tightest grouping */
space-2: 8px   /* Related elements */
space-3: 12px  /* Small gaps */
space-4: 16px  /* Standard spacing */
space-6: 24px  /* Section spacing */
space-8: 32px  /* Large spacing */
```

### Component Spacing Patterns
```css
/* Cards */
.card {
  padding: 24px; /* space-6 */
  gap: 24px;     /* Sections within cards */
}

/* Buttons */
.button {
  padding: 8px 16px; /* space-2 space-4 */
  gap: 8px;          /* Icon to text */
}

/* Form Fields */
.form-field {
  margin-bottom: 16px; /* space-4 between fields */
}

/* Page Sections */
.page-section {
  padding: 24px;       /* space-6 */
  margin-bottom: 32px; /* space-8 between sections */
}
```

---

## 🏗️ Component Architecture

### The Card Pattern
Cards are the **fundamental building block** of our UI:

```jsx
<Card className="shadow-sm">
  <CardHeader className="border-b">
    <CardTitle>Clear, Concise Title</CardTitle>
    <CardAction>
      <Button variant="ghost" size="icon">
        <Icon className="h-4 w-4" />
      </Button>
    </CardAction>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Content with consistent spacing */}
  </CardContent>
</Card>
```

### Button Hierarchy
```jsx
/* Primary - One per view */
<Button variant="default">Primary Action</Button>

/* Secondary - Supporting actions */
<Button variant="outline">Secondary Action</Button>

/* Tertiary - Low emphasis */
<Button variant="ghost">Tertiary Action</Button>

/* Danger - Destructive only */
<Button variant="destructive">Delete</Button>
```

### Form Control Consistency
```jsx
/* All inputs share the same height and padding */
<Input className="h-9 px-3" />
<Select className="h-9 px-3" />
<Button className="h-9 px-4" />
```

---

## 🎯 The "Product Suite" Feeling

### Visual Cohesion Checklist
To ensure products feel like part of the suite:

#### ✅ Consistent Elements
- [ ] Same border radius (10px) on all rounded elements
- [ ] Same shadow depths (xs, sm, md, lg only)
- [ ] Same focus ring style (3px, 50% opacity)
- [ ] Same transition duration (200ms)
- [ ] Same spacing scale (8-point grid)
- [ ] Same color application (never pure black/white)
- [ ] Same typography scale
- [ ] Same icon sizes (16px inline, 20px buttons)

#### ✅ Consistent Patterns
- [ ] Cards as primary containers
- [ ] Subtle borders over heavy dividers
- [ ] Ghost buttons for icon actions
- [ ] Left-aligned navigation
- [ ] Right-aligned actions
- [ ] Top-to-bottom information hierarchy
- [ ] Generous whitespace between sections

#### ✅ Consistent Behaviors
- [ ] Hover states lift slightly
- [ ] Focus states show glowing ring
- [ ] Loading states use gentle pulse
- [ ] Transitions are always 200ms
- [ ] Modals fade in with subtle scale
- [ ] Tooltips appear after 500ms delay
- [ ] Dropdowns open below with shadow-lg

### The Feeling Test
A product built with this system should feel:
- **Professional** but not corporate
- **Clean** but not sterile  
- **Modern** but not trendy
- **Calm** but not boring
- **Structured** but not rigid
- **Premium** but not pretentious

---

## 🚀 Implementation Strategy

### Phase 1: Foundation
1. Set up Tailwind CSS with custom configuration
2. Implement CSS custom properties for theming
3. Create base component library (Card, Button, Input, etc.)
4. Establish spacing and typography scales

### Phase 2: Component System
1. Build composite components using base components
2. Implement consistent patterns (forms, lists, tables)
3. Add animation utilities
4. Create layout templates

### Phase 3: Product Identity
1. Add product-specific accent colors
2. Implement product-specific features
3. Maintain consistent interaction patterns
4. Regular design system audits

---

## 🔧 Technical Setup

### Required Dependencies
```json
{
  "@tailwindcss/vite": "^4.1.7",
  "@radix-ui/react-*": "latest",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.0.0",
  "lucide-react": "latest"
}
```

### Tailwind Configuration
```js
module.exports = {
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: '0.625rem',
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm': '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    }
  }
}
```

### The `cn` Utility
```js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

---

## 📋 Quick Reference

### The 10 Commandments of Our Design System

1. **Thou shalt use 10px border radius** on all rounded elements
2. **Thou shalt not use shadows heavier than `shadow-lg`**
3. **Thou shalt maintain 24px padding** in cards
4. **Thou shalt use 200ms** for all transitions
5. **Thou shalt never use pure black or white**
6. **Thou shalt space elements on an 8px grid**
7. **Thou shalt use ghost buttons** for icon actions
8. **Thou shalt show focus with a glowing ring**
9. **Thou shalt lift elements 2px on hover**
10. **Thou shalt keep borders at 1px**

---

## 🎨 The Secret Sauce

The magic isn't in any single element—it's in the **consistency and restraint**. Every decision is deliberate:

- **Shadows are whispers**, not shouts
- **Borders define**, but don't dominate
- **Spacing lets the UI breathe**
- **Colors guide**, but don't overwhelm
- **Animations acknowledge**, but don't distract

When you build with this system, users should feel like they're using a **premium, thoughtfully-crafted tool** that gets out of their way and lets them focus on their work.

This is the feeling we're building across our entire product suite.