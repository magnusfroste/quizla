import imageCompression from 'browser-image-compression';

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
  fileType?: string;
  onProgress?: (progress: number) => void;
}

// Presets for different use cases
export const compressionPresets = {
  // Standard compression for study materials (handwritten notes, book photos)
  standard: {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 1800,
    initialQuality: 0.85,
  },
  // High quality for detailed diagrams or complex images
  highQuality: {
    maxSizeMB: 3,
    maxWidthOrHeight: 2400,
    initialQuality: 0.92,
  },
  // Thumbnail for gallery previews
  thumbnail: {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 400,
    initialQuality: 0.7,
  },
} as const;

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const defaultOptions = {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 1800,
    useWebWorker: true,
    initialQuality: 0.85,
    fileType: 'image/jpeg',
    ...options,
  };

  try {
    const compressedFile = await imageCompression(file, defaultOptions);
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original file if compression fails
    return file;
  }
}

export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
