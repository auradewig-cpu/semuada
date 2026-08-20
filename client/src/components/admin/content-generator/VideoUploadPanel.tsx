import { useRef, useState } from 'react';
import { Upload, CheckCircle2, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCreateVideoContent, uploadVideoToCloudinary } from "@/hooks/useVideoContent";

interface VideoUploadPanelProps {
  productId: string;
  category: string;
  subcategory: string | null;
  caption: string;
  hashtags: string[];
  promptSnapshot: string;
  // FK to the Content Generator output that produced these prompts -- stored
  // on the video row so the learning pipeline can trace performance back to
  // the generation. Null for manual uploads (this panel is always linked).
  contentGenerationId: string | null;
}

// The last step of the workflow: prompt was copied out to Google Flow (or
// any other AI video tool), rendered externally, and the finished file gets
// uploaded here -- straight to Cloudinary, organized into a folder per the
// product's category, with the caption/hashtags/prompt already generated
// above saved alongside it for the future social-scheduling feature.
export function VideoUploadPanel({ productId, category, subcategory, caption, hashtags, promptSnapshot, contentGenerationId }: VideoUploadPanelProps) {
  const { toast } = useToast();
  const createVideoContent = useCreateVideoContent();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);

  const isUploading = progress !== null;

  const handleFileSelected = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ variant: 'destructive', title: 'File tidak valid', description: 'Pilih file video (mp4, mov, dll).' });
      return;
    }
    setSelectedFile(file);
    setLastUploadedUrl(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setProgress(0);
    try {
      const result = await uploadVideoToCloudinary(selectedFile, category, setProgress);
      await createVideoContent.mutateAsync({
        product_id: productId,
        category,
        subcategory,
        caption,
        hashtags,
        prompt_snapshot: promptSnapshot,
        video_url: result.secure_url,
        cloudinary_public_id: result.public_id,
        storage_account_id: result.storage_account_id,
        content_generation_id: contentGenerationId,
      });
      setLastUploadedUrl(result.secure_url);
      setSelectedFile(null);
      toast({ title: 'Berhasil', description: 'Video tersimpan ke Video Library.' });
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Video className="h-4 w-4 mr-2" />
          Upload Video Hasil Editan
        </CardTitle>
        <CardDescription>
          Sudah generate video dari prompt di atas (mis. lewat Google Flow) dan sudah didownload? Upload file videonya di sini -- otomatis tersimpan ke Video Library dengan kategori "{category}" beserta caption &amp; hashtag di atas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <Upload className="h-4 w-4 mr-1" /> {selectedFile ? 'Ganti File' : 'Pilih File Video'}
          </Button>
          {selectedFile && (
            <span className="text-xs text-muted-foreground truncate max-w-xs">
              {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
            </span>
          )}
          {selectedFile && !isUploading && (
            <Button type="button" size="sm" onClick={handleUpload}>
              Upload
            </Button>
          )}
        </div>

        {isUploading && (
          <div className="space-y-1">
            <Progress value={progress ?? 0} />
            <p className="text-xs text-muted-foreground">{progress}% terupload...</p>
          </div>
        )}

        {lastUploadedUrl && !isUploading && (
          <p className="text-xs text-emerald flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Video tersimpan. Bisa upload video lain untuk produk yang sama kalau perlu.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
