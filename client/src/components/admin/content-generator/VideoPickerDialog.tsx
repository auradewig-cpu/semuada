import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useVideoContents, type VideoContent } from "@/hooks/useVideoContent";

interface VideoPickerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  category: string;
  // Excluded from the picker -- the video currently in this slot, so the
  // admin doesn't accidentally "swap" a video for itself.
  excludeVideoId?: string;
  onSelect: (video: VideoContent) => void;
}

// Lists the pool's still-available ("uploaded") videos for one category, so
// the admin can override which video fills an already-queued slot instead
// of the default FIFO auto-fill. Same thumbnail-grid convention as
// VideoLibraryTab.tsx, deliberately smaller/simpler (no edit/delete here).
export function VideoPickerDialog({ isOpen, onOpenChange, category, excludeVideoId, onSelect }: VideoPickerDialogProps) {
  const { data, isLoading } = useVideoContents(category);
  const available = (data?.items ?? []).filter((v) => v.status === "uploaded" && v.id !== excludeVideoId);

  const handleSelect = (video: VideoContent) => {
    onSelect(video);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pilih Video Pengganti</DialogTitle>
          <DialogDescription>
            Video dari kategori "{category}" yang belum terpakai. Video yang sedang di slot ini akan kembali ke pool.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat video...</p>
        ) : available.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada video lain yang tersedia di kategori ini.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {available.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => handleSelect(video)}
                className="text-left rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition"
              >
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={video.video_url} className="w-full aspect-[9/16] bg-black object-contain" muted />
                <div className="p-2">
                  {video.caption && <p className="text-xs line-clamp-2">{video.caption}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {video.created_at ? new Date(video.created_at).toLocaleDateString('id-ID') : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
