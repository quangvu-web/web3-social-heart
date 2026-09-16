import { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadToR2 } from '@/utils/r2Upload';
import { AvatarCropper } from './AvatarCropper';

interface AvatarEditorProps {
  userId: string;
  currentAvatarUrl?: string | null;
  username?: string;
  onAvatarUpdated: (newUrl: string) => void;
  size?: 'default' | 'large' | 'xl';
}

export function AvatarEditor({ 
  userId, 
  currentAvatarUrl, 
  username,
  onAvatarUpdated,
  size = 'large'
}: AvatarEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh phải nhỏ hơn 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      return;
    }

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
    setIsUploading(true);
    setCropImage(null);

    try {
      // Get session for access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vui lòng đăng nhập để tải ảnh lên');
        setIsUploading(false);
        return;
      }

      const file = new File([croppedImageBlob], 'avatar.jpg', { type: 'image/jpeg' });
      const result = await uploadToR2(file, 'avatars', `avatar-${Date.now()}.jpg`, session.access_token);

      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: result.url })
        .eq('id', userId);

      if (error) throw error;

      onAvatarUpdated(result.url);
      toast.success('Đã cập nhật ảnh đại diện');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Không thể tải lên ảnh đại diện');
    } finally {
      setIsUploading(false);
    }
  };

  const sizeClasses = size === 'xl'
    ? 'w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52'
    : size === 'large' 
      ? 'w-32 h-32 md:w-44 md:h-44' 
      : 'w-24 h-24';
  
  const buttonSizeClasses = size === 'xl'
    ? 'w-10 h-10 bottom-3 right-3'
    : size === 'large'
      ? 'w-9 h-9 bottom-2 right-2'
      : 'w-7 h-7 bottom-1 right-1';

  const iconSizeClasses = size === 'xl' ? 'w-5 h-5' : size === 'large' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <>
      <div className="relative">
        <div 
          className="rounded-full p-1"
          style={{
            background: 'linear-gradient(135deg, #166534 0%, #22c55e 50%, #16a34a 100%)'
          }}
        >
          <Avatar 
            className={`${sizeClasses} border-4 border-white`}
          >
            {currentAvatarUrl && <AvatarImage src={currentAvatarUrl} />}
            <AvatarFallback className="text-4xl md:text-5xl bg-primary text-white">
              {username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={`absolute ${buttonSizeClasses} bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors disabled:opacity-50`}
          aria-label="Thay đổi ảnh đại diện"
        >
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className={iconSizeClasses} />
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Avatar Cropper Dialog */}
      {cropImage && (
        <AvatarCropper
          image={cropImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImage(null)}
        />
      )}
    </>
  );
}
