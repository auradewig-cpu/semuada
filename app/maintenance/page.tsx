import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { getSiteSettings } from "@root/lib/site-settings";

export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSiteSettings();
  return {
    title: `Maintenance - ${siteName}`,
  };
}

export default async function MaintenancePage() {
  const { siteName, maintenanceMessage } = await getSiteSettings();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Wrench className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-3">{siteName} sedang dalam perbaikan</h1>
        <p className="text-muted-foreground">
          {maintenanceMessage || "Kami sedang melakukan pemeliharaan untuk meningkatkan layanan. Silakan kembali beberapa saat lagi."}
        </p>
      </div>
    </div>
  );
}
