# Color Application Guide

## Generated Color Variables
Based on your primary color, the system generates:
- `--color-primary`: Main brand color (muted to 40% saturation)
- `--color-secondary`: Complementary color (180° opposite, 30% saturation)
- `--color-accent`: Analogous color (30° offset, 25% saturation)
- `--color-neutral-*`: Gray scale with subtle primary tint

## Where to Apply Each Color

### Primary Color Applications
1. **Primary Actions**
   - Main CTA buttons (Save, Submit, Create)
   - Active navigation items
   - Selected states
   - Primary links
   - Focus indicators

2. **Branding Elements**
   - Logo accents
   - Header elements
   - Active tabs

### Secondary Color Applications (Complementary)
1. **Secondary Actions**
   - Secondary buttons ("Cancel", "Back")
   - Alternative CTAs
   - Hover states for contrast
   - Info badges/pills
   - Secondary navigation

2. **Data Visualization**
   - Chart series for contrast
   - Alternative data points
   - Comparison metrics

3. **Interactive Feedback**
   - Hover effects on cards
   - Selected list items
   - Active filters

### Accent Color Applications
1. **Highlights & Emphasis**
   - New/unread indicators
   - Notification badges
   - Success messages
   - Progress indicators
   - Important metrics

2. **Subtle Decorations**
   - Icon colors
   - Dividers with emphasis
   - Background tints for sections
   - Card hover borders

### Neutral Color Applications
1. **Text Hierarchy**
   - `neutral-900`: Main text
   - `neutral-700`: Secondary text
   - `neutral-500`: Muted text
   - `neutral-400`: Placeholder text

2. **Backgrounds**
   - `neutral-50`: Page background
   - `neutral-100`: Card backgrounds
   - `neutral-200`: Hover states
   - `neutral-300`: Borders

## Implementation Examples

### Buttons
```css
/* Primary button - uses primary color */
.btn-primary {
  background: var(--color-primary);
  color: white;
}
.btn-primary:hover {
  background: var(--color-primary-dark);
}

/* Secondary button - uses secondary (complementary) color */
.btn-secondary {
  background: var(--color-secondary);
  color: white;
}
.btn-secondary:hover {
  background: var(--color-secondary-dark);
}

/* Accent button - subtle emphasis */
.btn-accent {
  background: var(--color-accent);
  color: var(--color-neutral-900);
}
```

### Cards & Containers
```css
/* Card with hover effect using secondary color */
.card:hover {
  border-color: var(--color-secondary);
  box-shadow: 0 0 0 1px var(--color-secondary);
}

/* Active/selected card */
.card.selected {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}
```

### Badges & Pills
```css
/* Status badges */
.badge-primary {
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
}

.badge-secondary {
  background: var(--color-secondary-light);
  color: var(--color-secondary-dark);
}

.badge-accent {
  background: var(--color-accent);
  color: var(--color-neutral-900);
}
```

### Data Visualization
```css
/* Chart colors */
.chart-series-1 { color: var(--color-primary); }
.chart-series-2 { color: var(--color-secondary); }
.chart-series-3 { color: var(--color-accent); }
```

## Best Practices

1. **Use Primary Sparingly**: Reserve for main CTAs and key actions
2. **Secondary for Contrast**: Use complementary color when you need visual distinction
3. **Accent for Emphasis**: Draw attention without overwhelming
4. **Neutrals for Content**: Most text and UI should use neutral colors
5. **Test Accessibility**: Ensure sufficient contrast ratios
6. **Consistency**: Apply colors consistently across similar elements