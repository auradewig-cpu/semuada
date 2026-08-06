import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCreateVideoContent, uploadVideoToCloudinary } from "@/hooks/useVideoContent";
import { useCategoryContext } from "@/context/CategoryContext";

interface ManualVideoUploadDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// Upload path for videos that didn't come out of the Content Generator flow
// -- e.g. a video shot/edited entirely outside the app for a category, not
// tied to any one specific product row. Category is the only thing that
// determines the Cloudinary folder + video_contents grouping.
export function ManualVideoUploadDialog({ isOpen, onOpenChange }: ManualVideoUploadDialogProps) {
  const { toast } = useToast();
  const { hierarchy, isLoading: isCategoryLoading } = useCategoryContext();
  const createVideoContent = useCreateVideoContent();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<string | undefined>(undefined);
  const [subcategory, setSubcategory] = useState<string | undefined>(undefined);
  const [caption, setCaption] = useState('');
  const [hashtagsText, setHashtagsText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const subcategories = category ? Array.from(hierarchy.get(category) || []).sort() : [];
  const isUploading = progress !== null;

  const resetForm = () => {
    setCategory(undefined);
    setSubcategory(undefined);
    setCaption('');
    setHashtagsText('');
    setSelectedFile(null);
    setProgress(null);
  };

  const handleFileSelected = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ variant: 'destructive', title: 'File tidak valid', description: 'Pilih file video (mp4, mov, dll).' });
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!category) {
      toast({ variant: 'destructive', title: 'Kategori wajib dipilih', description: 'Pilih kategori produk untuk video ini.' });
      return;
    }
    if (!selectedFile) {
      toast({ variant: 'destructive', title: 'File belum dipilih', description: 'Pilih file video terlebih dahulu.' });
      return;
    }

    setProgress(0);
    try {
      const result = await uploadVideoToCloudinary(selectedFile, category, setProgress);
      const hashtags = hashtagsText.split(',').map((h) => h.trim()).filter(Boolean);
      await createVideoContent.mutateAsync({
        category,
        subcategory: subcategory ?? null,
        caption,
        hashtags,
        video_url: result.secure_url,
        cloudinary_public_id: result.public_id,
      });
      toast({ title: 'Berhasil', description: 'Video tersimpan ke Video Library.' });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal upload video',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isUploading) { onOpenChange(open); if (!open) resetForm(); } }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Video Manual</DialogTitle>
          <DialogDescription>
            Upload video yang tidak melalui alur Content Generator. Cukup pilih kategori produknya, video akan tersimpan dan terorganisir sesuai kategori tersebut.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select
                value={category ?? ''}
                onValueChange={(v) => { setCategory(v); setSubcategory(undefined); }}
                disabled={isUploading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {!isCategoryLoading &&
                    Array.from(hierarchy.keys()).sort().map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Subkategori (opsional)</Label>
              <Select
                value={subcategory ?? ''}
                onValueChange={setSubcategory}
                disabled={!category || subcategories.length === 0 || isUploading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih subkategori" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Caption</Label>
            <Textarea
              placeholder="Tulis caption untuk video ini..."
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Hashtag</Label>
            <Input
              placeholder="skincare, sunscreenlokal, tipsglowing (pisahkan dengan koma)"
              value={hashtagsText}
              onChange={(e) => setHashtagsText(e.target.value)}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-1.5">
            <Label>File Video</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                handleFileSelected(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                <Upload className="h-4 w-4 mr-1" /> {selectedFile ? 'Ganti File' : 'Pilih File Video'}
              </Button>
              {selectedFile && (
                <span className="text-xs text-muted-foreground truncate">
                  {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              )}
            </div>
          </div>

          {isUploading && (
            <div className="space-y-1">
              <Progress value={progress ?? 0} />
              <p className="text-xs text-muted-foreground">{progress}% terupload...</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Batal
          </Button>
          <Button type="button" onClick={handleUpload} disabled={isUploading}>
            {isUploading ? 'Mengupload...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
