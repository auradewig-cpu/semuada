import { useEffect, useState } from 'react';
import { Trash2, Film, Pencil, Upload, Database, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useVideoContents, useVideoContentStats, useDeleteVideoContent, useUpdateVideoContent, type VideoContent } from "@/hooks/useVideoContent";
import { useCategoryContext } from "@/context/CategoryContext";
import { ManualVideoUploadDialog } from "@/components/admin/content-generator/ManualVideoUploadDialog";
import { StorageAccountsDialog } from "@/components/admin/content-generator/StorageAccountsDialog";

type VideoSize = 'small' | 'medium' | 'large';

const SIZE_STORAGE_KEY = 'video-library-size';

const GRID_CLASSES: Record<VideoSize, string> = {
  small: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  medium: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  large: 'grid-cols-1 lg:grid-cols-2',
};

const SIZE_LABELS: { value: VideoSize; label: string }[] = [
  { value: 'small', label: 'Kecil' },
  { value: 'medium', label: 'Sedang' },
  { value: 'large', label: 'Besar' },
];

export function VideoLibraryTab() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  // Purely a display filter -- videos posted by the scheduler (see
  // lib/scheduler/dispatch.ts) get trashedAt set and drop out of the normal
  // pool view by default, same as before this existed; toggling this shows
  // only that trashed set instead. The purge-trash cron removes them for
  // real after 30 days, this is just for visibility before then.
  const [showTrashOnly, setShowTrashOnly] = useState(false);
  const { data, isLoading } = useVideoContents(category);
  const { data: stats } = useVideoContentStats();
  const { hierarchy, isLoading: isCategoryLoading } = useCategoryContext();
  const deleteVideoContent = useDeleteVideoContent();
  const updateVideoContent = useUpdateVideoContent();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<VideoContent | null>(null);
  const [editTarget, setEditTarget] = useState<VideoContent | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isStorageDialogOpen, setIsStorageDialogOpen] = useState(false);

  // Display preference only, no server round-trip needed -- read once on
  // mount (client-only, this tab never renders on the server) and persist
  // on change.
  const [size, setSize] = useState<VideoSize>('medium');
  useEffect(() => {
    const stored = localStorage.getItem(SIZE_STORAGE_KEY);
    if (stored === 'small' || stored === 'medium' || stored === 'large') {
      setSize(stored);
    }
  }, []);
  const handleSizeChange = (next: VideoSize) => {
    setSize(next);
    localStorage.setItem(SIZE_STORAGE_KEY, next);
  };

  const allVideos = data?.items ?? [];
  const videos = allVideos.filter((v) => (showTrashOnly ? v.trashed_at !== null : v.trashed_at === null));
  // Every count on this card describes the set currently on screen: the stock
  // view counts what is left in the pool, the trash view counts what is in the
  // trash. Anything else puts two numbers that contradict each other on the
  // same card -- which is exactly what the old "count everything not purged"
  // indicator did against the grid below it.
  const headlineCount = showTrashOnly ? stats?.trashedTotal : stats?.total;
  const categoryCount = (c: { available: number; trashed: number }) => (showTrashOnly ? c.trashed : c.available);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteVideoContent.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: 'Dihapus', description: 'Video berhasil dihapus.' });
        setDeleteTarget(null);
      },
      onError: (error) => {
        toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      },
    });
  };

  const openEdit = (video: VideoContent) => {
    setEditTarget(video);
    setEditCaption(video.caption ?? '');
    setEditHashtags((video.hashtags ?? []).join(', '));
  };

  const confirmEdit = () => {
    if (!editTarget) return;
    const hashtags = editHashtags.split(',').map((h) => h.trim()).filter(Boolean);
    updateVideoContent.mutate(
      { id: editTarget.id, caption: editCaption, hashtags },
      {
        onSuccess: () => {
          toast({ title: 'Tersimpan', description: 'Caption & hashtag berhasil diperbarui.' });
          setEditTarget(null);
        },
        onError: (error) => {
          toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-3">
            <span className="flex items-center">
              <Film className="h-5 w-5 mr-2" />
              {/* The "Sampah" qualifier is not decoration: without it a bare
                  "· 98 video" in the trash view reads as the library's size. */}
              Video Library{showTrashOnly ? ' · Sampah' : ''}
              {headlineCount !== undefined ? ` · ${headlineCount} video` : ''}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-md border">
                {SIZE_LABELS.map(({ value, label }) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={size === value ? 'secondary' : 'ghost'}
                    className="rounded-none first:rounded-l-md last:rounded-r-md"
                    onClick={() => handleSizeChange(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <Select value={category ?? 'all'} onValueChange={(v) => setCategory(v === 'all' ? undefined : v)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {!isCategoryLoading &&
                    Array.from(hierarchy.keys()).sort().map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant={showTrashOnly ? 'secondary' : 'outline'}
                onClick={() => setShowTrashOnly((v) => !v)}
              >
                {/* Global, from the stats endpoint. The previous count was
                    derived from the loaded list, so picking a category shrank
                    it to that category's trash while the chips beside it
                    stayed global -- two numbers, two scopes, one row. */}
                <Archive className="h-4 w-4 mr-1" /> Sampah{stats && stats.trashedTotal > 0 ? ` (${stats.trashedTotal})` : ''}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setIsStorageDialogOpen(true)}>
                <Database className="h-4 w-4 mr-1" /> Kelola Storage
              </Button>
              <Button type="button" size="sm" onClick={() => setIsUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-1" /> Upload Video Manual
              </Button>
            </div>
          </CardTitle>
          {stats && stats.byCategory.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {/* Categories at zero are deliberately still listed: "Perawatan &
                  Kecantikan (0)" is the out-of-stock warning worth seeing, and
                  a chip that disappears is easy to miss. The server keeps the
                  order fixed to available stock so nothing moves on toggle. */}
              {stats.byCategory.map((entry) => (
                <Button
                  key={entry.category}
                  type="button"
                  size="sm"
                  variant={category === entry.category ? 'secondary' : 'ghost'}
                  className="h-7 text-xs"
                  onClick={() => setCategory(category === entry.category ? undefined : entry.category)}
                >
                  {entry.category} ({categoryCount(entry)})
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat video...</p>
          ) : videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showTrashOnly ? 'Tidak ada video di sampah.' : 'Belum ada video yang diupload.'}
            </p>
          ) : (
            <div className={`grid ${GRID_CLASSES[size]} gap-4`}>
              {videos.map((video) => (
                <Card key={video.id} className="overflow-hidden">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={video.video_url} controls className="w-full aspect-[9/16] bg-black object-contain" />
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium bg-muted rounded px-2 py-0.5 truncate">
                        {video.category}{video.subcategory ? ` / ${video.subcategory}` : ''}
                      </span>
                      <div className="flex items-center shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(video)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(video)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {video.caption && <p className="text-xs line-clamp-3">{video.caption}</p>}
                    {video.hashtags && video.hashtags.length > 0 && (
                      <p className="text-xs text-primary truncate">
                        {video.hashtags.map((h) => `#${h.replace(/^#+/, '')}`).join(' ')}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {video.created_at ? new Date(video.created_at).toLocaleString('id-ID') : ''}
                    </p>
                    {video.trashed_at && (
                      <p className="text-[10px] text-amber-600">
                        {(() => {
                          const daysLeft = 30 - Math.floor((Date.now() - new Date(video.trashed_at).getTime()) / 86400000);
                          return daysLeft > 0 ? `Terhapus permanen dalam ${daysLeft} hari` : 'Akan terhapus permanen segera';
                        })()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ManualVideoUploadDialog isOpen={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen} />
      <StorageAccountsDialog isOpen={isStorageDialogOpen} onOpenChange={setIsStorageDialogOpen} />

      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Caption & Hashtag</DialogTitle>
            <DialogDescription>
              Ubah caption atau hashtag video ini secara manual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Textarea rows={4} value={editCaption} onChange={(e) => setEditCaption(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hashtag</Label>
              <Input
                placeholder="skincare, sunscreenlokal (pisahkan dengan koma)"
                value={editHashtags}
                onChange={(e) => setEditHashtags(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Batal
            </Button>
            <Button type="button" onClick={confirmEdit} disabled={updateVideoContent.isPending}>
              {updateVideoContent.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus video ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan -- video akan dihapus permanen dari Cloudinary dan Video Library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
