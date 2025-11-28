import { supabase } from "@/integrations/supabase/client";

// Cache for signed URLs
const urlCache = new Map<string, { url: string; expires: number }>();

export const storageService = {
  async getSignedUrl(storagePath: string): Promise<string> {
    const cached = urlCache.get(storagePath);
    const now = Date.now();

    if (cached && cached.expires > now) {
      return cached.url;
    }

    const { data } = await supabase.storage
      .from('study-materials')
      .createSignedUrl(storagePath, 3600);

    if (data?.signedUrl) {
      urlCache.set(storagePath, {
        url: data.signedUrl,
        expires: now + 59 * 60 * 1000,
      });
      return data.signedUrl;
    }

    throw new Error('Failed to get signed URL');
  },

  async getMultipleSignedUrls(storagePaths: string[]): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();

    await Promise.all(
      storagePaths.map(async (path) => {
        try {
          const url = await this.getSignedUrl(path);
          urlMap.set(path, url);
        } catch (error) {
          console.error(`Failed to get URL for ${path}:`, error);
        }
      })
    );

    return urlMap;
  },

  clearCache() {
    urlCache.clear();
  },
};
