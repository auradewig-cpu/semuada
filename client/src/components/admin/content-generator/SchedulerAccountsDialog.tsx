import { useState } from 'react';
import { CheckCircle2, XCircle, Plus, X, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSchedulerAccounts, useSaveSchedulerAccount, useDeleteSchedulerAccount, type SchedulerAccount } from "@/hooks/useScheduler";
import { useCategoryContext } from "@/context/CategoryContext";

interface SchedulerAccountsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const DEFAULT_BASE_TIMES = ['06:00', '12:00', '19:00'];

// Platform-to-provider is fixed by which free-tier connections the user
// actually has (Buffer: TikTok/Instagram/YouTube, Zernio: Threads/Facebook
// Page) -- the form reflects that grouping directly instead of offering a
// per-platform provider picker.
export function SchedulerAccountsDialog({ isOpen, onOpenChange }: SchedulerAccountsDialogProps) {
  const { toast } = useToast();
  const { hierarchy, isLoading: isCategoryLoading } = useCategoryContext();
  const { data, isLoading } = useSchedulerAccounts();
  const saveAccount = useSaveSchedulerAccount();
  const deleteAccount = useDeleteSchedulerAccount();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [bufferApiKey, setBufferApiKey] = useState('');
  const [zernioApiKey, setZernioApiKey] = useState('');
  const [tiktokId, setTiktokId] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [threadsId, setThreadsId] = useState('');
  const [facebookPageId, setFacebookPageId] = useState('');
  const [baseTimes, setBaseTimes] = useState<string[]>(DEFAULT_BASE_TIMES);
  const [incrementMinutes, setIncrementMinutes] = useState(5);
  const [capTime, setCapTime] = useState('22:00');
  const [isActive, setIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SchedulerAccount | null>(null);

  const accounts = data?.items ?? [];

  const resetForm = () => {
    setEditingId(null);
    setLabel('');
    setCategory(undefined);
    setBufferApiKey('');
    setZernioApiKey('');
    setTiktokId('');
    setInstagramId('');
    setYoutubeId('');
    setThreadsId('');
    setFacebookPageId('');
    setBaseTimes(DEFAULT_BASE_TIMES);
    setIncrementMinutes(5);
    setCapTime('22:00');
    setIsActive(true);
  };

  const loadForEdit = (a: SchedulerAccount) => {
    setEditingId(a.id);
    setLabel(a.label);
    setCategory(a.category);
    // API keys never come back from the server (masked as has_*) -- leaving
    // these blank on edit means "keep the existing key", only a non-blank
    // value overwrites it (enforced server-side in the save handler below).
    setBufferApiKey('');
    setZernioApiKey('');
    setTiktokId(a.tiktok_account_id ?? '');
    setInstagramId(a.instagram_account_id ?? '');
    setYoutubeId(a.youtube_account_id ?? '');
    setThreadsId(a.threads_account_id ?? '');
    setFacebookPageId(a.facebook_page_account_id ?? '');
    setBaseTimes(a.base_times.length > 0 ? a.base_times : DEFAULT_BASE_TIMES);
    setIncrementMinutes(a.increment_minutes);
    setCapTime(a.cap_time);
    setIsActive(a.is_active);
  };

  const updateBaseTime = (index: number, value: string) => {
    setBaseTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  };
  const addBaseTime = () => setBaseTimes((prev) => [...prev, '12:00']);
  const removeBaseTime = (index: number) => setBaseTimes((prev) => prev.filter((_, i) => i !== index));

  const handleSave = () => {
    if (!label.trim() || !category || baseTimes.length === 0 || !capTime) {
      toast({ variant: 'destructive', title: 'Lengkapi semua field', description: 'Label, kategori, minimal 1 jam dasar, dan jam batas wajib diisi.' });
      return;
    }
    saveAccount.mutate(
      {
        id: editingId ?? undefined,
        label: label.trim(),
        category,
        // Blank = "keep existing key" -- only send a key when the admin
        // actually typed a new one, so re-saving other fields never wipes an
        // already-configured credential.
        buffer_api_key: bufferApiKey.trim() ? bufferApiKey.trim() : undefined,
        zernio_api_key: zernioApiKey.trim() ? zernioApiKey.trim() : undefined,
        tiktok_account_id: tiktokId.trim() || null,
        instagram_account_id: instagramId.trim() || null,
        youtube_account_id: youtubeId.trim() || null,
        threads_account_id: threadsId.trim() || null,
        facebook_page_account_id: facebookPageId.trim() || null,
        base_times: baseTimes,
        increment_minutes: incrementMinutes,
        cap_time: capTime,
        is_active: isActive,
      },
      {
        onSuccess: () => {
          toast({ title: 'Tersimpan', description: `Akun "${label}" berhasil disimpan.` });
          resetForm();
        },
        onError: (error) => {
          toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
        },
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteAccount.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: 'Dihapus', description: `Akun "${deleteTarget.label}" dihapus.` });
        if (editingId === deleteTarget.id) resetForm();
        setDeleteTarget(null);
      },
      onError: (error) => {
        toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
        setDeleteTarget(null);
      },
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Akun Scheduler</DialogTitle>
            <DialogDescription>
              Tiap akun butuh 2 kredensial: API key Buffer (untuk TikTok/Instagram/YouTube) dan API key Zernio (untuk Threads/FB Page).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat akun...</p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada akun scheduler.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {accounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.label} {!a.is_active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.category} &middot; {a.base_times.join(' | ')} &middot; +{a.increment_minutes}mnt/hari</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span title="Kredensial Buffer">
                        {a.has_buffer_api_key ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      </span>
                      <span title="Kredensial Zernio">
                        {a.has_zernio_api_key ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      </span>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => loadForEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteTarget(a)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">{editingId ? 'Edit Akun' : 'Tambah Akun'}</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Label Akun</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Akun 1" disabled={saveAccount.isPending} autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label>Kategori (pool video)</Label>
                  <Select value={category ?? ''} onValueChange={setCategory} disabled={saveAccount.isPending}>
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
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">VIA BUFFER</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key Buffer {editingId && <span className="text-muted-foreground">(kosongkan = tidak diubah)</span>}</Label>
                  <Input type="password" value={bufferApiKey} onChange={(e) => setBufferApiKey(e.target.value)} disabled={saveAccount.isPending} autoComplete="new-password" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">TikTok Account ID</Label>
                    <Input value={tiktokId} onChange={(e) => setTiktokId(e.target.value)} disabled={saveAccount.isPending} autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Instagram Account ID</Label>
                    <Input value={instagramId} onChange={(e) => setInstagramId(e.target.value)} disabled={saveAccount.isPending} autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">YouTube Account ID</Label>
                    <Input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} disabled={saveAccount.isPending} autoComplete="off" />
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">VIA ZERNIO</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key Zernio {editingId && <span className="text-muted-foreground">(kosongkan = tidak diubah)</span>}</Label>
                  <Input type="password" value={zernioApiKey} onChange={(e) => setZernioApiKey(e.target.value)} disabled={saveAccount.isPending} autoComplete="new-password" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Threads Account ID</Label>
                    <Input value={threadsId} onChange={(e) => setThreadsId(e.target.value)} disabled={saveAccount.isPending} autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">FB Page Account ID</Label>
                    <Input value={facebookPageId} onChange={(e) => setFacebookPageId(e.target.value)} disabled={saveAccount.isPending} autoComplete="off" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Jam Dasar (rotasi bertambah tiap hari)</Label>
                <div className="space-y-1.5">
                  {baseTimes.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="time" value={t} onChange={(e) => updateBaseTime(i, e.target.value)} disabled={saveAccount.isPending} className="w-32" />
                      {baseTimes.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeBaseTime(i)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={addBaseTime}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah jam
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Interval Rotasi (menit/hari)</Label>
                  <Input type="number" min={1} value={incrementMinutes} onChange={(e) => setIncrementMinutes(Number(e.target.value) || 1)} disabled={saveAccount.isPending} />
                </div>
                <div className="space-y-1.5">
                  <Label>Jam Batas (jam dasar terakhir kembali ke awal di sini)</Label>
                  <Input type="time" value={capTime} onChange={(e) => setCapTime(e.target.value)} disabled={saveAccount.isPending} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="text-sm">Aktif</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} disabled={saveAccount.isPending} />
              </div>

              <div className="flex gap-2">
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={saveAccount.isPending}>
                    Batal Edit
                  </Button>
                )}
                <Button type="button" onClick={handleSave} disabled={saveAccount.isPending} className="flex-1">
                  {saveAccount.isPending ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Akun'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akun "{deleteTarget?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan -- jadwal yang sudah diantrekan untuk akun ini tetap tersimpan sebagai riwayat, tapi tidak akan diproses lagi.
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
    </>
  );
}
