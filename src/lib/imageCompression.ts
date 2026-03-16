import imageCompression from 'browser-image-compression';
import heic2any from 'heic2any';

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

const HEIC_TYPES = ['image/heic', 'image/heif'];

function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.includes(file.type.toLowerCase())) return true;
  const ext = file.name.toLowerCase();
  return ext.endsWith('.heic') || ext.endsWith('.heif');
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const blob = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });

  const resultBlob = Array.isArray(blob) ? blob[0] : blob;
  const newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
  return new File([resultBlob], newName, { type: 'image/jpeg' });
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  try {
    // Convert HEIC/HEIF to JPEG first
    let processedFile = file;
    if (isHeicFile(file)) {
      console.log(`Converting HEIC file: ${file.name}`);
      processedFile = await convertHeicToJpeg(file);
      console.log(`Converted to JPEG: ${processedFile.name}`);
    }

    const defaultOptions = {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1800,
      useWebWorker: true,
      initialQuality: 0.85,
      fileType: 'image/jpeg',
      ...options,
    };

    const compressedFile = await imageCompression(processedFile, defaultOptions);
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
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
