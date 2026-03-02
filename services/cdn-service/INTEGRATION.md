# CDN Service - Frontend Integration Guide

Guida per integrare upload immagini CDN in Management UI e visualizzazione in Game App.

---

## Management UI - Upload Component

### 1. API Client (`apps/management/src/lib/api/cdn.ts`)

```typescript
import { apiClient } from './client';

export interface CDNUploadResponse {
  success: boolean;
  urls: {
    main: string;
    thumbnail: string;
  };
  metadata: {
    hash: string;
    originalSize: number;
    processedSize: number;
    thumbnailSize: number;
  };
}

/**
 * Upload immagine al CDN
 * @param file File immagine da uploadare
 * @param type Tipo entità (location, item, character)
 * @param entityId MongoDB ObjectId dell'entità
 */
export async function uploadImage(
  file: File,
  type: 'location' | 'item' | 'character',
  entityId: string
): Promise<CDNUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  formData.append('entityId', entityId);

  const response = await apiClient.post<CDNUploadResponse>(
    '/cdn/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      // Timeout lungo per upload + processing
      timeout: 30000
    }
  );

  if (!response.data.success) {
    throw new Error('Upload failed');
  }

  return response.data;
}
```

### 2. Upload Component (`apps/management/src/components/cdn/ImageUpload.tsx`)

```typescript
import React, { useState, useCallback } from 'react';
import { uploadImage } from '@/lib/api/cdn';

interface ImageUploadProps {
  type: 'location' | 'item' | 'character';
  entityId: string;
  onUploadSuccess: (urls: { main: string; thumbnail: string }) => void;
  onUploadError?: (error: string) => void;
}

export function ImageUpload({
  type,
  entityId,
  onUploadSuccess,
  onUploadError
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        onUploadError?.('Tipo file non valido. Usa JPEG, PNG, WebP o GIF.');
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10485760) {
        onUploadError?.('File troppo grande. Max 10MB.');
        return;
      }

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      // Upload
      setUploading(true);
      setProgress(0);

      try {
        // Simulate progress (real progress richiede XMLHttpRequest)
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 10, 90));
        }, 500);

        const result = await uploadImage(file, type, entityId);

        clearInterval(progressInterval);
        setProgress(100);

        // Success
        onUploadSuccess(result.urls);

        // Log metadata
        console.log('Upload success:', {
          originalSize: (result.metadata.originalSize / 1024 / 1024).toFixed(2) + ' MB',
          processedSize: (result.metadata.processedSize / 1024 / 1024).toFixed(2) + ' MB',
          compression: (
            ((result.metadata.originalSize - result.metadata.processedSize) /
              result.metadata.originalSize) *
            100
          ).toFixed(0) + '%'
        });
      } catch (error) {
        console.error('Upload error:', error);
        onUploadError?.(
          error instanceof Error ? error.message : 'Errore durante upload'
        );
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [type, entityId, onUploadSuccess, onUploadError]
  );

  return (
    <div className="image-upload">
      {preview && (
        <div className="preview">
          <img src={preview} alt="Preview" />
        </div>
      )}

      <label className="upload-button">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          disabled={uploading}
        />
        {uploading ? 'Uploading...' : 'Seleziona Immagine'}
      </label>

      {uploading && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}
```

### 3. Usage Example - Location Edit Form

```typescript
import React, { useState } from 'react';
import { ImageUpload } from '@/components/cdn/ImageUpload';
import { updateLocation } from '@/lib/api/locations';

export function LocationEditForm({ location }: { location: Location }) {
  const [bannerUrl, setBannerUrl] = useState(location.images?.banner);
  const [thumbnailUrl, setThumbnailUrl] = useState(location.images?.thumbnail);

  const handleUploadSuccess = async (urls: { main: string; thumbnail: string }) => {
    // Update local state
    setBannerUrl(urls.main);
    setThumbnailUrl(urls.thumbnail);

    // Save to database
    await updateLocation(location._id, {
      images: {
        banner: urls.main,
        thumbnail: urls.thumbnail
      }
    });

    alert('Immagine aggiornata!');
  };

  return (
    <div className="location-edit-form">
      <h2>Modifica Location: {location.name}</h2>

      {/* Current images */}
      {bannerUrl && (
        <div className="current-image">
          <img src={bannerUrl} alt={location.name} />
        </div>
      )}

      {/* Upload new image */}
      <ImageUpload
        type="location"
        entityId={location._id}
        onUploadSuccess={handleUploadSuccess}
        onUploadError={(error) => alert(error)}
      />
    </div>
  );
}
```

---

## Game App - Image Display

### 1. Location Image Component (`apps/game/src/components/locations/LocationImage.tsx`)

```typescript
import React from 'react';

interface LocationImageProps {
  location: {
    name: string;
    images?: {
      banner?: string;
      thumbnail?: string;
    };
  };
  variant?: 'banner' | 'thumbnail';
}

export function LocationImage({
  location,
  variant = 'banner'
}: LocationImageProps) {
  const imageUrl = variant === 'banner'
    ? location.images?.banner
    : location.images?.thumbnail;

  // Fallback image
  const fallbackUrl = '/images/placeholder-location.webp';

  return (
    <img
      src={imageUrl || fallbackUrl}
      alt={location.name}
      loading="lazy"
      onError={(e) => {
        // Fallback se CDN fail
        e.currentTarget.src = fallbackUrl;
      }}
    />
  );
}
```

### 2. Usage in Location Card

```typescript
import React from 'react';
import { LocationImage } from '@/components/locations/LocationImage';

export function LocationCard({ location }: { location: Location }) {
  return (
    <div className="location-card">
      {/* Thumbnail per liste */}
      <LocationImage location={location} variant="thumbnail" />

      <div className="location-info">
        <h3>{location.name}</h3>
        <p>{location.description}</p>
      </div>
    </div>
  );
}
```

### 3. Usage in Location Detail

```typescript
import React from 'react';
import { LocationImage } from '@/components/locations/LocationImage';

export function LocationDetail({ location }: { location: Location }) {
  return (
    <div className="location-detail">
      {/* Banner full-size per dettaglio */}
      <div className="location-banner">
        <LocationImage location={location} variant="banner" />
      </div>

      <div className="location-content">
        <h1>{location.name}</h1>
        <p>{location.description}</p>
        {/* ... rest of content */}
      </div>
    </div>
  );
}
```

---

## Types - Estendi interfaces esistenti

### Location Type (`apps/management/src/types/Location.ts`)

```typescript
export interface Location {
  _id: string;
  name: string;
  slug: string;
  description: string;

  // ADD: Images from CDN
  images?: {
    banner?: string;      // Main image URL
    thumbnail?: string;   // Thumbnail URL
  };

  // ... other fields
}
```

### Item Type (`apps/management/src/types/Item.ts`)

```typescript
export interface Item {
  _id: string;
  name: string;
  description: string;

  // ADD: Images from CDN
  images?: {
    main?: string;
    thumbnail?: string;
  };

  // ... other fields
}
```

---

## Backend - Location Schema Update

### MongoDB Schema (`services/unified-backend/src/database/models/Location.ts`)

```typescript
import { Schema, model } from 'mongoose';

const LocationSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },

  // ADD: Images
  images: {
    banner: { type: String },      // CDN URL
    thumbnail: { type: String }     // CDN URL
  },

  // ... other fields
}, { timestamps: true });

export const Location = model('Location', LocationSchema);
```

### Update Location Endpoint

```typescript
// PATCH /admin/locations/:id
async updateLocation(req, res) {
  const { id } = req.params;
  const { images, ...otherFields } = req.body;

  const location = await Location.findByIdAndUpdate(
    id,
    {
      ...otherFields,
      images: {
        banner: images?.banner,
        thumbnail: images?.thumbnail
      }
    },
    { new: true }
  );

  res.json({ success: true, data: location });
}
```

---

## Advanced - Progress Tracking (Optional)

Per tracking progresso upload real-time, usa `XMLHttpRequest` invece di `fetch`:

```typescript
export async function uploadImageWithProgress(
  file: File,
  type: string,
  entityId: string,
  onProgress: (percent: number) => void
): Promise<CDNUploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('entityId', entityId);

    const xhr = new XMLHttpRequest();

    // Progress handler
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    // Success handler
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve(response);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    // Error handler
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    // Open and send
    xhr.open('POST', '/api/cdn/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.send(formData);
  });
}
```

---

## Performance Tips

### 1. Lazy Loading

```tsx
<img src={imageUrl} loading="lazy" />
```

### 2. Srcset for Responsive

Se generi multiple sizes:

```tsx
<img
  src={location.images?.thumbnail}
  srcSet={`
    ${location.images?.thumbnail} 300w,
    ${location.images?.banner} 1920w
  `}
  sizes="(max-width: 768px) 300px, 1920px"
/>
```

### 3. WebP with Fallback (se usi JPG fallback)

```tsx
<picture>
  <source srcSet={location.images?.banner} type="image/webp" />
  <img src={location.images?.bannerFallback} alt={location.name} />
</picture>
```

---

## Error Handling

### Common Errors

```typescript
try {
  await uploadImage(file, type, entityId);
} catch (error) {
  if (error.response?.status === 401) {
    // Unauthorized - redirect to login
    router.push('/login');
  } else if (error.response?.status === 413) {
    // File too large
    alert('File troppo grande. Max 10MB.');
  } else if (error.response?.status === 400) {
    // Invalid file type or params
    alert('File non valido. Usa JPEG, PNG, WebP o GIF.');
  } else {
    // Generic error
    alert('Errore durante upload. Riprova.');
  }
}
```

---

## Testing

### Unit Test - API Client

```typescript
import { uploadImage } from '@/lib/api/cdn';

describe('CDN API', () => {
  it('should upload image', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const result = await uploadImage(file, 'location', '507f1f77bcf86cd799439011');

    expect(result.success).toBe(true);
    expect(result.urls.main).toContain('cdn.tenpennynovels.com');
    expect(result.urls.thumbnail).toContain('thumb-');
  });
});
```

### E2E Test - Upload Flow

```typescript
import { test, expect } from '@playwright/test';

test('upload location image', async ({ page }) => {
  await page.goto('/admin/locations/123/edit');

  // Select file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('test-image.jpg');

  // Wait for upload
  await page.waitForSelector('.success-message');

  // Verify image appears
  const image = page.locator('.location-banner img');
  await expect(image).toHaveAttribute('src', /cdn\.tenpennynovels\.com/);
});
```

---

## Next Steps

1. Implementa `ImageUpload` component in management UI
2. Aggiungi campo `images` a Location/Item schemas
3. Update API endpoints per save URLs
4. Test upload + display flow
5. Deploy CDN service (vedi `/deploy/CDN_SETUP.md`)
