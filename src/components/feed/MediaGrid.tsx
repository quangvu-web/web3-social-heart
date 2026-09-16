import { useState, memo, useCallback } from 'react';
import { ImageViewer } from './ImageViewer';
import { LazyImage } from '@/components/ui/LazyImage';
import { LazyVideo } from '@/components/ui/LazyVideo';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface MediaGridProps {
  media: MediaItem[];
}

/**
 * Optimized MediaGrid component with lazy loading
 * - Supports up to 80 media items
 * - Gallery viewer for browsing all media
 * - Automatically filters out broken media
 */
export const MediaGrid = memo(({ media: initialMedia }: MediaGridProps) => {
  const [showViewer, setShowViewer] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());

  // Filter out broken media
  const media = initialMedia.filter(item => !brokenUrls.has(item.url));

  const handleMediaError = useCallback((url: string) => {
    setBrokenUrls(prev => new Set(prev).add(url));
  }, []);

  if (media.length === 0) return null;

  const remainingCount = media.length - 4;

  const handleClick = (index: number) => {
    setSelectedIndex(index);
    setShowViewer(true);
  };

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
  };

  // Single media
  if (media.length === 1) {
    const item = media[0];
    return (
      <>
        {item.type === 'video' ? (
          <LazyVideo
            src={item.url}
            className="w-full max-h-[600px] bg-black"
            showControls
            muted
            onError={() => handleMediaError(item.url)}
          />
        ) : (
          <div 
            className="cursor-pointer"
            onClick={() => handleClick(0)}
          >
            <LazyImage
              src={item.url}
              alt="Post media"
              className="w-full max-h-[600px] bg-black"
              hideOnError
              onLoadError={() => handleMediaError(item.url)}
              transformPreset="post"
            />
          </div>
        )}
        <MediaGalleryViewer
          media={media}
          isOpen={showViewer}
          onClose={() => setShowViewer(false)}
          currentIndex={selectedIndex}
          onPrev={handlePrev}
          onNext={handleNext}
          setIndex={setSelectedIndex}
        />
      </>
    );
  }

  // Two media
  if (media.length === 2) {
    return (
      <>
        <div className="grid grid-cols-2 gap-1">
          {media.map((item, index) => (
            <div key={item.url} className="aspect-square overflow-hidden">
              {item.type === 'video' ? (
                <div onClick={() => handleClick(index)} className="cursor-pointer h-full">
                  <LazyVideo
                    src={item.url}
                    className="w-full h-full object-cover"
                    showControls
                    muted
                    onError={() => handleMediaError(item.url)}
                  />
                </div>
              ) : (
                <div onClick={() => handleClick(index)} className="cursor-pointer h-full">
                  <LazyImage
                    src={item.url}
                    alt={`Media ${index + 1}`}
                    className="w-full h-full hover:opacity-95 transition-opacity"
                    hideOnError
                    onLoadError={() => handleMediaError(item.url)}
                    transformPreset="post-grid"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <MediaGalleryViewer
          media={media}
          isOpen={showViewer}
          onClose={() => setShowViewer(false)}
          currentIndex={selectedIndex}
          onPrev={handlePrev}
          onNext={handleNext}
          setIndex={setSelectedIndex}
        />
      </>
    );
  }

  // Three media - Image 1 on top left, Image 2 on top right, Image 3 on bottom left
  if (media.length === 3) {
    return (
      <>
        <div className="grid grid-cols-2 grid-rows-2 gap-1">
          {/* Image 1 - Top left */}
          <div className="aspect-square overflow-hidden">
            {media[0].type === 'video' ? (
              <div onClick={() => handleClick(0)} className="cursor-pointer h-full">
                <LazyVideo
                  src={media[0].url}
                  className="w-full h-full object-cover"
                  showControls
                  muted
                  onError={() => handleMediaError(media[0].url)}
                />
              </div>
            ) : (
              <div onClick={() => handleClick(0)} className="cursor-pointer h-full">
                <LazyImage
                  src={media[0].url}
                  alt="Media 1"
                  className="w-full h-full hover:opacity-95"
                  hideOnError
                  onLoadError={() => handleMediaError(media[0].url)}
                  transformPreset="post-grid"
                />
              </div>
            )}
          </div>
          {/* Image 2 - Top right, spans 2 rows */}
          <div className="row-span-2 aspect-auto overflow-hidden">
            {media[1].type === 'video' ? (
              <div onClick={() => handleClick(1)} className="cursor-pointer h-full">
                <LazyVideo
                  src={media[1].url}
                  className="w-full h-full object-cover"
                  showControls
                  muted
                  onError={() => handleMediaError(media[1].url)}
                />
              </div>
            ) : (
              <div onClick={() => handleClick(1)} className="cursor-pointer h-full">
                <LazyImage
                  src={media[1].url}
                  alt="Media 2"
                  className="w-full h-full hover:opacity-95"
                  hideOnError
                  onLoadError={() => handleMediaError(media[1].url)}
                  transformPreset="post-grid"
                />
              </div>
            )}
          </div>
          {/* Image 3 - Bottom left */}
          <div className="aspect-square overflow-hidden">
            {media[2].type === 'video' ? (
              <div onClick={() => handleClick(2)} className="cursor-pointer h-full">
                <LazyVideo
                  src={media[2].url}
                  className="w-full h-full object-cover"
                  showControls
                  muted
                  onError={() => handleMediaError(media[2].url)}
                />
              </div>
            ) : (
              <div onClick={() => handleClick(2)} className="cursor-pointer h-full">
                <LazyImage
                  src={media[2].url}
                  alt="Media 3"
                  className="w-full h-full hover:opacity-95"
                  hideOnError
                  onLoadError={() => handleMediaError(media[2].url)}
                  transformPreset="post-grid"
                />
              </div>
            )}
          </div>
        </div>
        <MediaGalleryViewer
          media={media}
          isOpen={showViewer}
          onClose={() => setShowViewer(false)}
          currentIndex={selectedIndex}
          onPrev={handlePrev}
          onNext={handleNext}
          setIndex={setSelectedIndex}
        />
      </>
    );
  }

  // Four or more media
  return (
    <>
      <div className="grid grid-cols-2 gap-1">
        {media.slice(0, 4).map((item, index) => (
          <div 
            key={item.url} 
            className="aspect-square overflow-hidden relative"
          >
            {item.type === 'video' ? (
              <div onClick={() => handleClick(index)} className="cursor-pointer h-full">
                <LazyVideo
                  src={item.url}
                  className="w-full h-full object-cover"
                  showControls={false}
                  muted
                  onError={() => handleMediaError(item.url)}
                />
              </div>
            ) : (
              <div onClick={() => handleClick(index)} className="cursor-pointer h-full">
                <LazyImage
                  src={item.url}
                  alt={`Media ${index + 1}`}
                  className="w-full h-full hover:opacity-95"
                  hideOnError
                  onLoadError={() => handleMediaError(item.url)}
                  transformPreset="post-grid"
                />
              </div>
            )}
            {index === 3 && remainingCount > 0 && (
              <div 
                className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer"
                onClick={() => handleClick(3)}
              >
                <span className="text-white text-3xl font-bold">+{remainingCount}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <MediaGalleryViewer
        media={media}
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
        currentIndex={selectedIndex}
        onPrev={handlePrev}
        onNext={handleNext}
        setIndex={setSelectedIndex}
      />
    </>
  );
});

MediaGrid.displayName = 'MediaGrid';

// Gallery viewer component for browsing all media
interface MediaGalleryViewerProps {
  media: MediaItem[];
  isOpen: boolean;
  onClose: () => void;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  setIndex?: (index: number) => void;
}

const MediaGalleryViewer = memo(({ media, isOpen, onClose, currentIndex, onPrev, onNext, setIndex }: MediaGalleryViewerProps) => {
  if (!isOpen || media.length === 0) return null;

  const currentMedia = media[currentIndex];

  const handleThumbnailClick = (index: number) => {
    if (setIndex) {
      setIndex(index);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
        <div className="relative w-full h-[90vh] flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 z-50 bg-black/50 px-3 py-1 rounded-full text-white text-sm">
            {currentIndex + 1} / {media.length}
          </div>

          {/* Previous button */}
          {media.length > 1 && (
            <button
              onClick={onPrev}
              className="absolute left-4 z-50 w-12 h-12 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Media content */}
          <div className="max-w-full max-h-full flex items-center justify-center p-4">
            {currentMedia.type === 'video' ? (
              <video
                key={currentMedia.url}
                src={currentMedia.url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] object-contain"
              />
            ) : (
              <img
                key={currentMedia.url}
                src={currentMedia.url}
                alt={`Media ${currentIndex + 1}`}
                className="max-w-full max-h-[85vh] object-contain"
              />
            )}
          </div>

          {/* Next button */}
          {media.length > 1 && (
            <button
              onClick={onNext}
              className="absolute right-4 z-50 w-12 h-12 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Thumbnail strip for many images */}
          {media.length > 4 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 max-w-[80vw] overflow-x-auto p-2 bg-black/50 rounded-lg">
              {media.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleThumbnailClick(index)}
                  className={`w-12 h-12 flex-shrink-0 rounded overflow-hidden border-2 transition-all ${
                    index === currentIndex ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  {item.type === 'video' ? (
                    <video src={item.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

MediaGalleryViewer.displayName = 'MediaGalleryViewer';
