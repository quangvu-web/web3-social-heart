import { useMemo } from 'react';
import { 
  getTransformedImageUrl, 
  getAvatarUrl, 
  getCoverUrl, 
  getPostGridUrl,
  getResponsiveSrcSet,
  ImageTransformOptions 
} from '@/lib/imageTransform';

/**
 * Hook for image transformation utilities
 * 
 * @example
 * const { transformUrl, avatarUrl, coverUrl } = useImageTransform();
 * 
 * // Transform any image
 * const optimizedUrl = transformUrl(originalUrl, { preset: 'thumbnail' });
 * 
 * // Get optimized avatar
 * const avatar = avatarUrl(user.avatar_url, 'lg');
 */
export function useImageTransform() {
  return useMemo(() => ({
    /**
     * Transform any image URL with options
     */
    transformUrl: (url: string | null | undefined, options?: ImageTransformOptions) => 
      getTransformedImageUrl(url, options),
    
    /**
     * Get optimized avatar URL
     */
    avatarUrl: (url: string | null | undefined, size?: 'sm' | 'md' | 'lg') => 
      getAvatarUrl(url, size),
    
    /**
     * Get optimized cover photo URL
     */
    coverUrl: (url: string | null | undefined) => 
      getCoverUrl(url),
    
    /**
     * Get optimized post grid image URL
     */
    postGridUrl: (url: string | null | undefined) => 
      getPostGridUrl(url),
    
    /**
     * Get responsive srcset for an image
     */
    responsiveSrcSet: (url: string | null | undefined, widths?: number[]) => 
      getResponsiveSrcSet(url, widths),
  }), []);
}

/**
 * Hook to get a single transformed image URL
 * Memoized to prevent unnecessary recalculations
 * 
 * @example
 * const optimizedAvatar = useTransformedImage(user.avatar_url, { preset: 'avatar' });
 */
export function useTransformedImage(
  url: string | null | undefined, 
  options?: ImageTransformOptions
): string {
  return useMemo(
    () => getTransformedImageUrl(url, options),
    [url, options?.preset, options?.width, options?.height, options?.format, options?.filter]
  );
}

/**
 * Hook for avatar images with size variants
 * 
 * @example
 * const { sm, md, lg } = useAvatarVariants(user.avatar_url);
 */
export function useAvatarVariants(url: string | null | undefined) {
  return useMemo(() => ({
    sm: getAvatarUrl(url, 'sm'),
    md: getAvatarUrl(url, 'md'),
    lg: getAvatarUrl(url, 'lg'),
    original: url || '/placeholder.svg',
  }), [url]);
}
