import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/imageTransform";

export const DEFAULT_AVATAR_SRC = "/fun-profile-logo-128.webp";

/** Resolve an avatar source without persisting a default value to user data. */
export function resolveAvatarImageSource(src: string | null | undefined): string {
  const candidate = src?.trim();
  if (!candidate) return DEFAULT_AVATAR_SRC;

  if (candidate.startsWith('/') || candidate.startsWith('data:') || candidate.startsWith('blob:')) {
    return candidate;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? candidate
      : DEFAULT_AVATAR_SRC;
  } catch {
    return DEFAULT_AVATAR_SRC;
  }
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

interface AvatarImageProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> {
  /** Size hint for optimization: 'sm' (40px), 'md' (128px), 'lg' (256px) */
  sizeHint?: 'sm' | 'md' | 'lg';
  /** Skip Cloudflare Image transformation */
  skipTransform?: boolean;
}

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  AvatarImageProps
>(({ className, src, sizeHint = 'md', skipTransform = false, onError, ...props }, ref) => {
  const resolvedSrc = resolveAvatarImageSource(src);
  const [failedToLoad, setFailedToLoad] = React.useState(false);
  const effectiveSrc = failedToLoad ? DEFAULT_AVATAR_SRC : resolvedSrc;

  React.useEffect(() => {
    setFailedToLoad(false);
  }, [resolvedSrc]);

  // Transform URL via Cloudflare Image Resizing for optimization
  const optimizedSrc = React.useMemo(() => {
    if (skipTransform || effectiveSrc === DEFAULT_AVATAR_SRC) return effectiveSrc;
    return getAvatarUrl(effectiveSrc, sizeHint);
  }, [effectiveSrc, sizeHint, skipTransform]);

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (effectiveSrc !== DEFAULT_AVATAR_SRC) setFailedToLoad(true);
    onError?.(event);
  };

  return (
    <AvatarPrimitive.Image 
      ref={ref} 
      src={optimizedSrc}
      onError={handleError}
      className={cn("aspect-square h-full w-full", className)} 
      {...props} 
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
