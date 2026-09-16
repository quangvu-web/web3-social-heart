import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadToR2, deleteFromR2, extractR2KeyFromUrl } from '@/utils/r2Upload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Upload, AlertTriangle } from 'lucide-react';
import { AvatarCropper } from './AvatarCropper';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { z } from 'zod';
import { compressImage, FILE_LIMITS } from '@/utils/imageCompression';
import { useLanguage } from '@/i18n/LanguageContext';
import { Wallet, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const profileSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .trim(),
  full_name: z.string()
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .optional(),
  bio: z.string()
    .max(120, 'Bio must be less than 120 characters')
    .trim()
    .optional(),
});

export const EditProfile = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const { t } = useLanguage();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setUsername(data.username || '');
      setFullName(data.full_name || '');
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url || '');
      setCoverUrl(data.cover_url || '');
      setWalletAddress(data.wallet_address || null);
    } catch (error) {
      // Error fetching profile - silent fail for security
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];

      // Validate file size (max 100MB)
      const MAX_SIZE = 100 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        toast.error('File quá lớn! Vui lòng chọn file dưới 100MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setCropImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Error loading image');
    }
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    try {
      setUploading(true);
      setCropImage(null);

      if (!userId) throw new Error('No user found');

      // Get session for access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vui lòng đăng nhập để tải ảnh lên');
        setUploading(false);
        return;
      }

      const file = new File([croppedImageBlob], 'avatar.jpg', { type: 'image/jpeg' });
      const result = await uploadToR2(file, 'avatars', `avatar-${Date.now()}.jpg`, session.access_token);

      // Delete old avatar from R2 if exists
      if (avatarUrl) {
        try {
          const oldKey = extractR2KeyFromUrl(avatarUrl);
          if (oldKey) await deleteFromR2(oldKey);
        } catch (error) {
          console.error('Error deleting old avatar:', error);
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: result.url })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(result.url);
      toast.success('Avatar updated successfully!');
    } catch (error) {
      toast.error('Error uploading avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];

      if (file.size > FILE_LIMITS.IMAGE_MAX_SIZE) {
        toast.error('File quá lớn! Vui lòng chọn file dưới 100MB');
        return;
      }

      setUploadingCover(true);

      if (!userId) throw new Error('No user found');

      // Get session for access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vui lòng đăng nhập để tải ảnh lên');
        setUploadingCover(false);
        return;
      }

      // Compress cover image
      toast.loading('Đang nén ảnh...');
      const compressed = await compressImage(file, {
        maxWidth: FILE_LIMITS.COVER_MAX_WIDTH,
        maxHeight: FILE_LIMITS.COVER_MAX_HEIGHT,
        quality: 0.85,
      });
      toast.dismiss();

      const coverFile = new File([compressed], 'cover.jpg', { type: 'image/jpeg' });
      const result = await uploadToR2(coverFile, 'avatars', `cover-${Date.now()}.jpg`, session.access_token);

      // Delete old cover from R2 if exists
      if (coverUrl) {
        try {
          const oldKey = extractR2KeyFromUrl(coverUrl);
          if (oldKey) await deleteFromR2(oldKey);
        } catch (error) {
          console.error('Error deleting old cover:', error);
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cover_url: result.url })
        .eq('id', userId);

      if (updateError) throw updateError;

      setCoverUrl(result.url);
      toast.success('Ảnh bìa đã được cập nhật!');
    } catch (error) {
      toast.error('Lỗi khi tải ảnh bìa');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate profile fields
    const validation = profileSchema.safeParse({ 
      username, 
      full_name: fullName || undefined,
      bio: bio || undefined 
    });
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setLoading(true);

    try {
      if (!userId) throw new Error('No user found');

      const { error } = await supabase
        .from('profiles')
        .update({
          username,
          full_name: fullName,
          bio,
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {cropImage && (
        <AvatarCropper
          image={cropImage}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImage(null)}
        />
      )}
      <Card className="overflow-hidden">
        <div className="relative">
          {coverUrl && (
            <div className="w-full h-48 bg-gradient-to-r from-primary/20 to-primary-glow/20">
              <img 
                src={coverUrl} 
                alt="Cover" 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {!coverUrl && (
            <div className="w-full h-48 bg-gradient-to-r from-primary/20 to-primary-glow/20" />
          )}
          <div className="absolute top-4 right-4">
            <Label htmlFor="cover" className="cursor-pointer">
              <Button type="button" variant="secondary" size="sm" disabled={uploadingCover} asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingCover ? 'Đang tải...' : 'Đổi ảnh bìa'}
                </span>
              </Button>
            </Label>
            <Input
              id="cover"
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
              disabled={uploadingCover}
            />
          </div>
        </div>
        <CardHeader>
          <CardTitle>Chỉnh sửa hồ sơ</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="w-32 h-32 -mt-20 border-4 border-background">
                {avatarUrl && <AvatarImage src={avatarUrl} />}
                <AvatarFallback className="text-4xl">
                  {username?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2">
                <Label htmlFor="avatar" className="cursor-pointer">
                  <Button type="button" variant="outline" disabled={uploading} asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Đang tải...' : 'Tải ảnh đại diện'}
                    </span>
                  </Button>
                </Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Tên người dùng</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên người dùng"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Họ và tên</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Tiểu sử</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 120))}
                placeholder="Giới thiệu về bạn (tối đa 120 ký tự)"
                rows={4}
                maxLength={120}
              />
              <p className="text-xs text-muted-foreground">{bio.length}/120 ký tự</p>
            </div>
            {/* Web3 Wallet - Read Only */}
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Ví Web3
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Địa chỉ ví được tự động đồng bộ từ ví đã liên kết tài khoản.
                  </div>
                </div>
                {walletAddress && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Tự động đồng bộ
                  </Badge>
                )}
              </div>

              {walletAddress ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Wallet className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-mono text-sm">{walletAddress}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span>Chưa có ví liên kết. </span>
                    <a
                      href="/settings/account"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Liên kết ví tại Cài đặt tài khoản
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Đang cập nhật...' : 'Cập nhật hồ sơ'}
            </Button>
          </form>
        </CardContent>
      </Card>

    </>
  );
};
