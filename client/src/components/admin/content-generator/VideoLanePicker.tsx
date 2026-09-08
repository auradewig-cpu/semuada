import { TriangleAlert } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchedulerAccounts } from "@/hooks/useScheduler";
import { useProductFocus } from "@/hooks/useVideoContent";

// Sentinel for "no account" -- Radix Select cannot hold an empty-string value,
// and null isn't a valid SelectItem value either.
export const SHARED_POOL = '__shared__';

interface VideoLanePickerProps {
  category: string;
  value: string | null;
  onChange: (schedulerAccountId: string | null) => void;
  /** When set, warns if this product is already another account's focus. */
  productId?: string | null;
  disabled?: boolean;
}

// Picks which scheduler account a video is reserved for ("its lane"), or leaves
// it in the shared per-category pool.
//
// Shared by the generator's upload panel, the manual upload dialog and the bulk
// assign dialog so all three offer the same choices and the same warning --
// three copies of this rule would drift.
//
// Only accounts in the video's OWN category are listed: the API refuses a
// cross-category assignment, because a lane belonging to an account that never
// builds for that category is a lane nothing ever drains.
export function VideoLanePicker({ category, value, onChange, productId, disabled }: VideoLanePickerProps) {
  const { data: accountsData } = useSchedulerAccounts();
  const accounts = (accountsData?.items ?? []).filter((a) => a.is_active && a.category === category);

  const { data: focusData } = useProductFocus(productId);
  const focus = focusData?.items ?? [];
  // Accounts other than the one selected that already own videos of this
  // product. Putting the same product on a second account recreates the exact
  // cross-account similarity lanes exist to prevent -- so it warns, but never
  // blocks: moving a product's focus deliberately is legitimate.
  const conflicting = focus.filter((f) => f.scheduler_account_id !== value);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Wadah akun</Label>
      <Select
        value={value ?? SHARED_POOL}
        onValueChange={(v) => onChange(v === SHARED_POOL ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SHARED_POOL}>Otomatis (kolam bersama)</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {accounts.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Belum ada akun scheduler aktif untuk kategori &quot;{category}&quot; -- video masuk kolam bersama.
        </p>
      ) : value === null ? (
        <p className="text-[11px] text-muted-foreground">
          Video bisa diambil akun mana saja di kategori ini, yang paling lama duluan.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Hanya akun ini yang bisa mengambilnya. Urutan tayang mengikuti urutan upload.
        </p>
      )}

      {value !== null && conflicting.length > 0 && (
        <p className="text-[11px] text-amber-600 flex items-start gap-1">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>
            Produk ini sudah jadi fokus{' '}
            {conflicting.map((f) => `${f.label} (${f.count} video)`).join(', ')}. Menaruhnya di dua akun bikin
            kontennya mirip antar-akun -- lanjutkan hanya kalau memang disengaja.
          </span>
        </p>
      )}
    </div>
  );
}
