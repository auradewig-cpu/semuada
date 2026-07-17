import type { Product } from "@/types";

interface ImagePickerProps {
  product: Product;
  usageCounts: Record<string, number>;
  onAddScene: (url: string) => void;
}

// Clicking a photo ADDS a new scene using that photo -- the same photo can be
// clicked multiple times to reuse it across several scenes (unlike the old
// toggle-select behavior, which capped each photo at one scene).
export function ImagePicker({ product, usageCounts, onAddScene }: ImagePickerProps) {
  const allImages = [product.image_url, ...(product.image_urls || [])].filter((url): url is string => Boolean(url));

  if (allImages.length === 0) {
    return <p className="text-sm text-muted-foreground">Produk ini belum punya foto.</p>;
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">
        Klik foto untuk menambahkan scene baru -- foto yang sama boleh diklik berkali-kali untuk dipakai di beberapa scene.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {allImages.map((url) => {
          const count = usageCounts[url] ?? 0;
          return (
            <button
              type="button"
              key={url}
              onClick={() => onAddScene(url)}
              className={`relative rounded-lg overflow-hidden border-2 aspect-square ${
                count > 0 ? 'border-primary' : 'border-transparent'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              {count > 0 && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                  {count}x
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
