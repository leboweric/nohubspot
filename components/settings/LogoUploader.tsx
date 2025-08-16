'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useToast } from '../ui/use-toast';
import { Upload, X, Image, Link, Maximize2 } from 'lucide-react';

interface LogoUploaderProps {
  currentLogoUrl?: string | null;
  currentLogoSize?: number;
  onLogoChange?: (logoUrl: string | null, logoSize?: number) => void;
  onSave?: (logoUrl: string | null, logoSize?: number) => Promise<void>;
  saving?: boolean;
}

export default function LogoUploader({
  currentLogoUrl,
  currentLogoSize = 100,
  onLogoChange,
  onSave,
  saving = false
}: LogoUploaderProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl || null);
  const [logoSize, setLogoSize] = useState<number>(currentLogoSize);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasExistingLogo] = useState<boolean>(!!currentLogoUrl && !currentLogoUrl.startsWith('data:'));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Update logoSize when prop changes (after save/reload)
  useEffect(() => {
    console.log('LogoUploader: currentLogoSize prop changed to:', currentLogoSize);
    setLogoSize(currentLogoSize);
  }, [currentLogoSize]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPG, PNG, GIF, SVG, or WebP image.',
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB.',
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    
    // Create a preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid image URL.',
        variant: 'destructive',
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(urlInput);
      setLogoUrl(urlInput);
      if (onLogoChange) {
        onLogoChange(urlInput);
      }
      setUrlInput('');
      toast({
        title: 'Logo URL set',
        description: 'Your logo URL has been set successfully.',
      });
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setSelectedFile(null);
    setUrlInput('');
    if (onLogoChange) {
      onLogoChange(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    console.log('Save button clicked, selectedFile:', selectedFile?.name, 'logoUrl type:', logoUrl?.substring(0, 50));
    
    if (!onSave) {
      console.log('No onSave handler provided');
      return;
    }

    // Don't proceed if nothing to save
    if (!selectedFile && !logoUrl && !currentLogoUrl) {
      toast({
        title: 'No logo selected',
        description: 'Please select a logo file or enter a URL.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      let finalLogoUrl = logoUrl;

      // If a file is selected, upload it first
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app';
        const token = localStorage.getItem('auth_token');
        
        console.log('Uploading file to:', `${baseUrl}/api/organization/logo/upload`);
        console.log('Token exists:', !!token);
        console.log('File size:', selectedFile.size, 'Type:', selectedFile.type);

        const response = await fetch(`${baseUrl}/api/organization/logo/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        console.log('Upload response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          finalLogoUrl = data.logo_url;
          console.log('Upload successful, logo URL received:', finalLogoUrl);
          // Update the component state with the actual URL, not the data URL
          setLogoUrl(finalLogoUrl);
        } else {
          const errorText = await response.text();
          console.error('Upload failed:', response.status, errorText);
          throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }
      } else if (logoUrl && logoUrl.startsWith('data:')) {
        // If we have a data URL and the current logo is also a data URL, 
        // we're just updating the size - allow this
        if (currentLogoUrl && currentLogoUrl.startsWith('data:')) {
          console.log('Using existing data URL logo, just updating size');
          finalLogoUrl = currentLogoUrl;
        } else if (currentLogoUrl && !currentLogoUrl.startsWith('data:')) {
          console.log('Using existing logo URL, just updating size');
          finalLogoUrl = currentLogoUrl;
        } else {
          console.log('Warning: No valid logo URL to save');
          toast({
            title: 'Error',
            description: 'Please upload a new logo file.',
            variant: 'destructive',
          });
          return;
        }
      }

      // Allow data URLs if that's what's already stored
      // (for backwards compatibility with existing logos)
      if (finalLogoUrl && finalLogoUrl.startsWith('data:') && !currentLogoUrl?.startsWith('data:')) {
        console.error('Attempted to save new data URL, aborting');
        toast({
          title: 'Error',
          description: 'Invalid logo URL format. Please try uploading again.',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Calling onSave with URL:', finalLogoUrl?.substring(0, 100), 'Size:', logoSize);
      
      // Save the logo URL and size to the organization
      await onSave(finalLogoUrl, logoSize);
      console.log('onSave completed successfully');
      
      // Clear selected file after successful save
      setSelectedFile(null);
      
      toast({
        title: 'Logo Updated',
        description: finalLogoUrl ? 'Your organization logo and size have been saved.' : 'Your organization logo has been removed.',
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save logo. Please try again.',
        variant: 'destructive',
      });
      throw error; // Re-throw to trigger the finally block in the parent
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Organization Logo
        </CardTitle>
        <CardDescription>
          Upload your organization's logo to display in the navigation bar. Recommended size: 200x60 pixels.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Logo Preview */}
        <div className="space-y-3">
          <Label>Current Logo</Label>
          <div className="p-4 border rounded-lg bg-gray-50">
            {logoUrl ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center h-16">
                  <img 
                    src={logoUrl} 
                    alt="Organization Logo" 
                    className="max-h-full object-contain"
                    style={{ maxWidth: `${logoSize * 2}px` }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      toast({
                        title: 'Error',
                        description: 'Failed to load logo image.',
                        variant: 'destructive',
                      });
                    }}
                  />
                </div>
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove Logo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Image className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No logo uploaded</p>
                <p className="text-xs text-gray-400 mt-1">Default "NHS" text will be displayed</p>
              </div>
            )}
          </div>
        </div>

        {/* Logo Size Slider */}
        {logoUrl && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                Logo Size
              </Label>
              <span className="text-sm text-muted-foreground">{logoSize}%</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">50%</span>
              <input
                type="range"
                min="50"
                max="150"
                value={logoSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value);
                  console.log('Slider changed to:', newSize);
                  setLogoSize(newSize);
                  if (onLogoChange) {
                    onLogoChange(logoUrl, newSize);
                  }
                }}
                onMouseUp={async (e) => {
                  // Auto-save when user finishes dragging
                  const newSize = parseInt((e.target as HTMLInputElement).value);
                  console.log('Auto-saving logo size:', newSize);
                  try {
                    // Pass undefined for URL to only update size
                    await onSave(undefined, newSize);
                  } catch (error) {
                    console.error('Failed to auto-save logo size:', error);
                  }
                }}
                onTouchEnd={async (e) => {
                  // Auto-save for touch devices
                  const newSize = parseInt((e.target as HTMLInputElement).value);
                  console.log('Auto-saving logo size (touch):', newSize);
                  try {
                    // Pass undefined for URL to only update size
                    await onSave(undefined, newSize);
                  } catch (error) {
                    console.error('Failed to auto-save logo size:', error);
                  }
                }}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, rgb(var(--color-primary)) 0%, rgb(var(--color-primary)) ${((logoSize - 50) / 100) * 100}%, #e5e7eb ${((logoSize - 50) / 100) * 100}%, #e5e7eb 100%)`
                }}
              />
              <span className="text-xs text-muted-foreground">150%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Adjust the size of your logo in the navigation bar
            </p>
          </div>
        )}

        {/* Upload Method Tabs */}
        <div className="space-y-3">
          <Label>Select Logo Source</Label>
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={uploadMethod === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUploadMethod('file')}
            >
              <Upload className="h-4 w-4 mr-2" />
              From Computer
            </Button>
            <Button
              type="button"
              variant={uploadMethod === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUploadMethod('url')}
            >
              <Link className="h-4 w-4 mr-2" />
              From URL
            </Button>
          </div>

          {/* File Upload */}
          {uploadMethod === 'file' && (
            <div className="space-y-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: JPG, PNG, GIF, SVG, WebP (max 5MB)
              </p>
              {selectedFile && (
                <p className="text-xs text-green-600">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
          )}

          {/* URL Input */}
          {uploadMethod === 'url' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleUrlSubmit();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim()}
                >
                  Set URL
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the URL of your logo image
              </p>
            </div>
          )}
        </div>

        {/* Save Button */}
        {onSave && (
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={handleSave} 
              disabled={saving || isUploading}
              className="min-w-[100px]"
            >
              {saving || isUploading ? 'Saving...' : selectedFile ? 'Upload & Save Logo' : hasExistingLogo ? 'Save Size' : 'Save Logo'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}