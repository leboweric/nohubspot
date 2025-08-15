'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useToast } from '../ui/use-toast';
import { Check, Palette } from 'lucide-react';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface ColorThemePickerProps {
  currentTheme?: ThemeColors;
  onThemeChange?: (theme: ThemeColors) => void;
  onSave?: (theme: ThemeColors) => Promise<void>;
  saving?: boolean;
}

// Preset themes from the design document
const presetThemes = [
  {
    name: 'Blue (Default)',
    description: 'Trust, stability',
    colors: { primary: '#3B82F6', secondary: '#1E40AF', accent: '#60A5FA' }
  },
  {
    name: 'Orange (Vibrant)',
    description: 'Energy, creativity',
    colors: { primary: '#FB923C', secondary: '#C2410C', accent: '#FED7AA' }
  },
  {
    name: 'Green (Growth)',
    description: 'Success, progress',
    colors: { primary: '#22C55E', secondary: '#15803D', accent: '#86EFAC' }
  },
  {
    name: 'Purple (Professional)',
    description: 'Premium, sophisticated',
    colors: { primary: '#A855F7', secondary: '#7C3AED', accent: '#D8B4FE' }
  },
  {
    name: 'Red (Energy)',
    description: 'Urgency, action',
    colors: { primary: '#EF4444', secondary: '#B91C1C', accent: '#FCA5A5' }
  },
  {
    name: 'Teal (Modern)',
    description: 'Fresh, innovative',
    colors: { primary: '#14B8A6', secondary: '#0F766E', accent: '#5EEAD4' }
  },
  {
    name: 'Gray (Neutral)',
    description: 'Minimal, focused',
    colors: { primary: '#6B7280', secondary: '#374151', accent: '#D1D5DB' }
  },
  {
    name: 'Indigo (Trust)',
    description: 'Reliable, corporate',
    colors: { primary: '#6366F1', secondary: '#4338CA', accent: '#A5B4FC' }
  }
];

export default function ColorThemePicker({
  currentTheme = { primary: '#3B82F6', secondary: '#1E40AF', accent: '#60A5FA' },
  onThemeChange,
  onSave,
  saving = false
}: ColorThemePickerProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeColors>(currentTheme);
  const [customMode, setCustomMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if current theme matches any preset
    const matchesPreset = presetThemes.some(preset => 
      preset.colors.primary === currentTheme.primary &&
      preset.colors.secondary === currentTheme.secondary &&
      preset.colors.accent === currentTheme.accent
    );
    setCustomMode(!matchesPreset);
  }, [currentTheme]);

  const handlePresetSelect = (preset: typeof presetThemes[0]) => {
    setSelectedTheme(preset.colors);
    setCustomMode(false);
    if (onThemeChange) {
      onThemeChange(preset.colors);
    }
  };

  const handleCustomColorChange = (colorType: keyof ThemeColors, value: string) => {
    // Validate hex color format
    if (!/^#[0-9A-Fa-f]{6}$/.test(value) && value !== '') {
      return;
    }
    
    const newTheme = { ...selectedTheme, [colorType]: value };
    setSelectedTheme(newTheme);
    setCustomMode(true);
    
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  const handleSave = async () => {
    console.log('Saving theme:', selectedTheme);
    if (!onSave) return;

    try {
      await onSave(selectedTheme);
      toast({
        title: 'Theme Updated',
        description: 'Your brand colors have been saved successfully.',
      });
    } catch (error) {
      console.error('Failed to save theme:', error);
      toast({
        title: 'Error',
        description: 'Failed to save theme colors. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const isThemeSelected = (preset: typeof presetThemes[0]) => {
    return !customMode &&
      preset.colors.primary === selectedTheme.primary &&
      preset.colors.secondary === selectedTheme.secondary &&
      preset.colors.accent === selectedTheme.accent;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Brand Colors
        </CardTitle>
        <CardDescription>
          Choose your organization's brand colors. These will be applied throughout the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview Section */}
        <div className="p-4 border rounded-lg space-y-3">
          <Label>Preview</Label>
          <div className="flex gap-4">
            <div className="flex-1">
              <div 
                className="h-24 rounded-lg shadow-sm flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: selectedTheme.primary }}
              >
                Primary
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">{selectedTheme.primary}</p>
            </div>
            <div className="flex-1">
              <div 
                className="h-24 rounded-lg shadow-sm flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: selectedTheme.secondary }}
              >
                Secondary
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">{selectedTheme.secondary}</p>
            </div>
            <div className="flex-1">
              <div 
                className="h-24 rounded-lg shadow-sm flex items-center justify-center text-gray-800 font-semibold"
                style={{ backgroundColor: selectedTheme.accent }}
              >
                Accent
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">{selectedTheme.accent}</p>
            </div>
          </div>
        </div>

        {/* Preset Themes */}
        <div className="space-y-3">
          <Label>Preset Themes</Label>
          <div className="grid grid-cols-2 gap-3">
            {presetThemes.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset)}
                className={`p-3 border rounded-lg text-left hover:bg-accent/50 transition-colors ${
                  isThemeSelected(preset) ? 'border-primary bg-accent/20' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                  </div>
                  {isThemeSelected(preset) && (
                    <Check className="h-4 w-4 text-primary mt-0.5" />
                  )}
                </div>
                <div className="flex gap-1 mt-2">
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: preset.colors.primary }}
                  />
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: preset.colors.secondary }}
                  />
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: preset.colors.accent }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Colors */}
        <div className="space-y-3">
          <Label>Custom Colors</Label>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary-color" className="text-xs">Primary</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={selectedTheme.primary}
                  onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={selectedTheme.primary}
                  onChange={(e) => handleCustomColorChange('primary', e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1 h-9"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color" className="text-xs">Secondary</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary-color"
                  type="color"
                  value={selectedTheme.secondary}
                  onChange={(e) => handleCustomColorChange('secondary', e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={selectedTheme.secondary}
                  onChange={(e) => handleCustomColorChange('secondary', e.target.value)}
                  placeholder="#1E40AF"
                  className="flex-1 h-9"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent-color" className="text-xs">Accent</Label>
              <div className="flex gap-2">
                <Input
                  id="accent-color"
                  type="color"
                  value={selectedTheme.accent}
                  onChange={(e) => handleCustomColorChange('accent', e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={selectedTheme.accent}
                  onChange={(e) => handleCustomColorChange('accent', e.target.value)}
                  placeholder="#60A5FA"
                  className="flex-1 h-9"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {onSave && (
          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="min-w-[100px]"
            >
              {saving ? 'Saving...' : 'Save Theme'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}