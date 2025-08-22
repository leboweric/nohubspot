/**
 * Color utility functions for consistent color usage across the app
 * Maps old bright colors to new gray-based design system
 */

/**
 * Get chart/metric colors (all gray variations now)
 */
export function getMetricColor(type: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'): string {
  const colorMap = {
    primary: 'bg-gray-600',
    secondary: 'bg-gray-500',
    success: 'bg-gray-700',
    warning: 'bg-gray-400',
    error: 'bg-gray-600',
    info: 'bg-gray-500'
  };
  return colorMap[type] || 'bg-gray-500';
}

/**
 * Get action item colors based on priority
 */
export function getActionItemColor(priority: 'urgent' | 'high' | 'medium' | 'low'): string {
  const colorMap = {
    urgent: 'bg-gray-700',
    high: 'bg-gray-600',
    medium: 'bg-gray-500',
    low: 'bg-gray-400'
  };
  return colorMap[priority] || 'bg-gray-500';
}

/**
 * Get status badge colors
 */
export function getStatusBadgeColor(status: string): string {
  const statusMap: Record<string, string> = {
    'active': 'bg-gray-100 text-gray-800 border-gray-300',
    'inactive': 'bg-gray-50 text-gray-600 border-gray-200',
    'pending': 'bg-gray-50 text-gray-700 border-gray-200',
    'completed': 'bg-gray-200 text-gray-900 border-gray-400',
    'success': 'bg-gray-100 text-gray-700',
    'error': 'bg-gray-100 text-gray-700',
    'warning': 'bg-gray-50 text-gray-600'
  };
  return statusMap[status.toLowerCase()] || 'bg-gray-50 text-gray-700 border-gray-200';
}

/**
 * Get text colors for links and actions
 */
export function getActionTextColor(type: 'primary' | 'danger' | 'warning' | 'success'): string {
  // All actions now use gray colors
  const colorMap = {
    primary: 'text-gray-600 hover:text-gray-800',
    danger: 'text-gray-600 hover:text-gray-700',
    warning: 'text-gray-500 hover:text-gray-600',
    success: 'text-gray-700 hover:text-gray-800'
  };
  return colorMap[type] || 'text-gray-600 hover:text-gray-700';
}

/**
 * Get button colors
 */
export function getButtonColor(variant: 'primary' | 'secondary' | 'danger' | 'success'): string {
  const colorMap = {
    primary: 'bg-gray-600 text-white hover:bg-gray-700',
    secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    danger: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    success: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  };
  return colorMap[variant] || colorMap.secondary;
}

/**
 * Get alert/notification colors
 */
export function getAlertColor(type: 'error' | 'warning' | 'success' | 'info'): {
  background: string;
  border: string;
  text: string;
  icon: string;
} {
  // All alerts use subtle gray variations
  const colorMap = {
    error: {
      background: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-800',
      icon: 'text-gray-600'
    },
    warning: {
      background: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-700',
      icon: 'text-gray-500'
    },
    success: {
      background: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-800',
      icon: 'text-gray-600'
    },
    info: {
      background: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-700',
      icon: 'text-gray-500'
    }
  };
  
  return colorMap[type] || colorMap.info;
}

/**
 * Get chart colors (returns array of gray shades)
 */
export function getChartColors(count: number = 5): string[] {
  const grayShades = [
    'rgb(31, 41, 55)',    // gray-800
    'rgb(55, 65, 81)',    // gray-700
    'rgb(75, 85, 99)',    // gray-600
    'rgb(107, 114, 128)', // gray-500
    'rgb(156, 163, 175)', // gray-400
    'rgb(209, 213, 219)', // gray-300
  ];
  
  return grayShades.slice(0, count);
}

/**
 * Get icon colors
 */
export function getIconColor(type: 'primary' | 'secondary' | 'muted'): string {
  const colorMap = {
    primary: 'text-gray-700',
    secondary: 'text-gray-600',
    muted: 'text-gray-400'
  };
  return colorMap[type] || 'text-gray-500';
}