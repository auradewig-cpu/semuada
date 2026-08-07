import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useVideoStorageAccounts, useSaveVideoStorageAccount } from "@/hooks/useVideoStorageAccounts";
import { useCategoryContext } from "@/context/CategoryContext";

interface StorageAccountsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

// Lets an admin map each product category to its own Cloudinary account
// (free-tier storage spread across several accounts) and add new mappings
// on the fly -- categories without a mapping fall back to the "Perawatan &
// Kecantikan" account server-side (see lib/videoStorage.ts).
export function StorageAccountsDialog({ isOpen, onOpenChange }: StorageAccountsDialogProps) {
  const { toast } = useToast();
  const { hierarchy, isLoading: isCategoryLoading } = useCategoryContext();
  const { data, isLoading } = useVideoStorageAccounts();
  const saveAccount = useSaveVideoStorageAccount();

  const [category, setCategory] = useState<string | undefined>(undefined);
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const accounts = data?.items ?? [];
  const mappedCategories = new Set(accounts.map((a) => a.category));

  const resetForm = () => {
    setCategory(undefined);
    setCloudName('');
    setApiKey('');
    setApiSecret('');
  };

  const handleSave = () => {
    if (!category || !cloudName.trim() || !apiKey.trim() || !apiSecret.trim()) {
      toast({ variant: 'destructive', title: 'Lengkapi semua field', description: 'Kategori, cloud name, API key, dan API secret wajib diisi.' });
      return;
    }
    saveAccount.mutate(
      { category, cloud_name: cloudName.trim(), api_key: apiKey.trim(), api_secret: apiSecret.trim() },
      {
        onSuccess: () => {
          toast({ title: 'Tersimpan', description: `Storage untuk "${category}" berhasil disimpan.` });
          resetForm();
        },
        onError: (error) => {
          toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Kelola Storage</DialogTitle>
          <DialogDescription>
            Setiap kategori bisa punya akun Cloudinary sendiri. Kategori yang belum dipetakan otomatis memakai storage Perawatan & Kecantikan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat storage...</p>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada storage yang dikonfigurasi.</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.category}</div>
                    <div className="text-xs text-muted-foreground truncate">{a.cloud_name}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                    {a.has_api_key && a.has_api_secret ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Tambah Storage</p>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={category ?? ''} onValueChange={setCategory} disabled={saveAccount.isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {!isCategoryLoading &&
                    Array.from(hierarchy.keys()).sort().map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}{mappedCategories.has(c) ? ' (sudah ada)' : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Cloudinary Cloud Name</Label>
                <Input value={cloudName} onChange={(e) => setCloudName(e.target.value)} disabled={saveAccount.isPending} />
              </div>
              <div className="space-y-1.5">
                <Label>API Key</Label>
                <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={saveAccount.isPending} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>API Secret</Label>
              <Input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} disabled={saveAccount.isPending} />
            </div>
            <Button type="button" onClick={handleSave} disabled={saveAccount.isPending} className="w-full">
              {saveAccount.isPending ? 'Menyimpan...' : 'Simpan Storage'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
