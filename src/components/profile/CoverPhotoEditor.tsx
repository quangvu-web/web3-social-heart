import { useState, useRef } from 'react';
import { Camera, Upload, ImageIcon, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadToR2 } from '@/utils/r2Upload';
import { CoverCropper } from './CoverCropper';

// Template cover images - using high-quality placeholder URLs
const coverTemplates = [
  {
    id: 'tropical-beach',
    name: 'Tropical Beach',
    nameVi: 'Bãi biển nhiệt đới',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=225&fit=crop'
  },
  {
    id: 'lush-forest',
    name: 'Lush Forest',
    nameVi: 'Rừng cây tươi tốt',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=225&fit=crop'
  },
  {
    id: 'blossoming-garden',
    name: 'Blossoming Garden',
    nameVi: 'Vườn hoa nở rộ',
    url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=225&fit=crop'
  },
  {
    id: 'clear-stream',
    name: 'Clear Stream',
    nameVi: 'Dòng suối trong vắt',
    url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=225&fit=crop'
  },
  {
    id: 'golden-sunset',
    name: 'Golden Sunset',
    nameVi: 'Hoàng hôn vàng',
    url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400&h=225&fit=crop'
  },
  {
    id: 'mountain-peak',
    name: 'Mountain Peak',
    nameVi: 'Đỉnh núi hùng vĩ',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=225&fit=crop'
  },
  {
    id: 'lotus-pond',
    name: 'Lotus Pond',
    nameVi: 'Ao sen bình yên',
    url: 'https://images.unsplash.com/photo-1474557157379-8aa74a6ef541?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1474557157379-8aa74a6ef541?w=400&h=225&fit=crop'
  },
  {
    id: 'aurora-sky',
    name: 'Aurora Sky',
    nameVi: 'Bầu trời cực quang',
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=225&fit=crop'
  },
  {
    id: 'sakura-blossom',
    name: 'Sakura Blossom',
    nameVi: 'Hoa anh đào',
    url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400&h=225&fit=crop'
  },
  {
    id: 'lavender-field',
    name: 'Lavender Field',
    nameVi: 'Cánh đồng oải hương',
    url: 'https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=400&h=225&fit=crop'
  },
  {
    id: 'ocean-wave',
    name: 'Ocean Wave',
    nameVi: 'Sóng biển xanh',
    url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&h=225&fit=crop'
  },
  {
    id: 'starry-night',
    name: 'Starry Night',
    nameVi: 'Đêm đầy sao',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=225&fit=crop'
  },
  {
    id: 'waterfall',
    name: 'Waterfall',
    nameVi: 'Thác nước hùng vĩ',
    url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=400&h=225&fit=crop'
  },
  {
    id: 'autumn-forest',
    name: 'Autumn Forest',
    nameVi: 'Rừng mùa thu',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=400&h=225&fit=crop'
  },
  {
    id: 'sea-bay',
    name: 'Sea Bay',
    nameVi: 'Vịnh biển',
    url: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=400&h=225&fit=crop'
  },
  {
    id: 'coral-reef',
    name: 'Coral Reef',
    nameVi: 'Rạn san hô',
    url: 'https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=400&h=225&fit=crop'
  }
];

interface CoverPhotoEditorProps {
  userId: string;
  currentCoverUrl?: string | null;
  onCoverUpdated: (newUrl: string) => void;
}

export function CoverPhotoEditor({ userId, currentCoverUrl, onCoverUpdated }: CoverPhotoEditorProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (100MB max - will be compressed)
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Ảnh phải nhỏ hơn 100MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      return;
    }

    setIsMenuOpen(false);

    // Read file and open cropper
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    setCropImage(null);
    setIsUploading(true);

    try {
      // Get session for access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vui lòng đăng nhập để tải ảnh lên');
        setIsUploading(false);
        return;
      }

      const file = new File([croppedImageBlob], 'cover.jpg', { type: 'image/jpeg' });
      
      // Upload to R2 using 'avatars' bucket with access token
      const result = await uploadToR2(file, 'avatars', `cover-${Date.now()}.jpg`, session.access_token);
      const uploadedUrl = result.url;
      
      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .update({ cover_url: uploadedUrl })
        .eq('id', userId);

      if (error) throw error;

      onCoverUpdated(uploadedUrl);
      toast.success('Đã cập nhật ảnh bìa');
    } catch (error) {
      console.error('Error uploading cover:', error);
      toast.error('Không thể tải lên ảnh bìa');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectTemplate = async (templateUrl: string) => {
    setSelectedTemplate(templateUrl);
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    setIsUploading(true);

    try {
      // Update profile with template URL directly
      const { error } = await supabase
        .from('profiles')
        .update({ cover_url: selectedTemplate })
        .eq('id', userId);

      if (error) throw error;

      onCoverUpdated(selectedTemplate);
      setIsTemplateLibraryOpen(false);
      setSelectedTemplate(null);
      toast.success('Đã áp dụng ảnh bìa mẫu');
    } catch (error) {
      console.error('Error applying template:', error);
      toast.error('Không thể áp dụng ảnh bìa');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Edit Cover Button */}
      <div className="relative">
      <Button 
        size="sm" 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="bg-black/60 text-white hover:bg-black/80 shadow-lg border border-white/20 backdrop-blur-sm font-medium"
        disabled={isUploading}
      >
        <Camera className="w-4 h-4 mr-2" />
        {isUploading ? 'Đang tải...' : 'Chỉnh sửa ảnh bìa'}
      </Button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-0 bottom-full mb-2 w-56 bg-card rounded-lg shadow-xl border border-border py-2 z-[200] backdrop-blur-sm">
            <button
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-3 transition-colors"
            >
              <Upload className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Tải ảnh lên</p>
                <p className="text-xs text-muted-foreground">Chọn ảnh từ thiết bị</p>
              </div>
            </button>
            <button
              onClick={() => {
                setIsMenuOpen(false);
                setIsTemplateLibraryOpen(true);
              }}
              className="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-3 transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-gold" />
              <div>
                <p className="font-medium text-foreground">Chọn từ Kho Mẫu</p>
                <p className="text-xs text-muted-foreground">Ảnh bìa thiên nhiên đẹp</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Template Library Modal */}
      <Dialog open={isTemplateLibraryOpen} onOpenChange={setIsTemplateLibraryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-primary" />
              Kho Ảnh Bìa Mẫu
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <p className="text-muted-foreground">
              Chọn một ảnh bìa từ bộ sưu tập thiên nhiên và sự thịnh vượng
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {coverTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.url)}
                  className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all duration-200 group ${
                    selectedTemplate === template.url 
                      ? 'border-primary ring-2 ring-primary/30 scale-[1.02]' 
                      : 'border-transparent hover:border-primary/50 hover:scale-[1.02]'
                  }`}
                >
                  <img
                    src={template.thumbnail}
                    alt={template.nameVi}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Overlay with name */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end">
                    <p className="text-white text-xs font-medium p-2 truncate w-full">
                      {template.nameVi}
                    </p>
                  </div>
                  {/* Selected Checkmark */}
                  {selectedTemplate === template.url && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Preview and Apply - inside scrollable area */}
            {selectedTemplate && (
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Xem trước:</p>
                <div className="relative aspect-[3/1] rounded-lg overflow-hidden mb-4">
                  <img
                    src={selectedTemplate}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  {/* Gradient Edge Effect Preview */}
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/50 to-transparent" />
                  <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white via-white/50 to-transparent" />
                </div>
                <div className="flex gap-2 justify-end sticky bottom-0 bg-background py-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedTemplate(null)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Hủy
                  </Button>
                  <Button 
                    onClick={handleApplyTemplate}
                    disabled={isUploading}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {isUploading ? 'Đang áp dụng...' : 'Áp dụng ảnh bìa'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Click outside to close menu */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-[199]" 
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Cover Cropper Dialog */}
      {cropImage && (
        <CoverCropper
          image={cropImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImage(null)}
        />
      )}
    </>
  );
}
