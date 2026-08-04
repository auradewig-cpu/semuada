import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useSettings, useUpdateSettings, useUploadSettingsImage } from "@/hooks/useSettings"; // Assuming BarChart3 is not used elsewhere
import { useToast } from "@/hooks/use-toast";
import { Facebook, MonitorSmartphone, Folder, ImagePlus, Store, Mail, Phone, MapPin, MessageCircle, Instagram, Twitter, Search, AlertTriangle } from 'lucide-react';
import { AiProviderSettings } from "@/components/admin/AiProviderSettings";

const settingsFormSchema = z.object({
  show_category_filter: z.boolean(),
  facebook_pixel_id: z.string().optional(),
  google_analytics_id: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

const brandingFormSchema = z.object({
  site_name: z.string().min(1, 'Nama website tidak boleh kosong.'),
  site_tagline: z.string().optional(),
});

type BrandingFormValues = z.infer<typeof brandingFormSchema>;

const contactFormSchema = z.object({
  contact_email: z.string().email('Format email tidak valid.').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  contact_address: z.string().optional(),
  whatsapp_number: z.string().optional(),
  social_facebook_url: z.string().url('URL tidak valid.').optional().or(z.literal('')),
  social_twitter_url: z.string().url('URL tidak valid.').optional().or(z.literal('')),
  social_instagram_url: z.string().url('URL tidak valid.').optional().or(z.literal('')),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

const seoFormSchema = z.object({
  seo_meta_description: z.string().optional(),
});

type SeoFormValues = z.infer<typeof seoFormSchema>;

const maintenanceFormSchema = z.object({
  maintenance_mode: z.boolean(),
  maintenance_message: z.string().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>;

// Small inline logo/favicon upload control: picks a file, uploads it
// immediately via useUploadSettingsImage, then saves the resulting URL onto
// the given settings field right away (decoupled from the "Identitas Situs"
// text-field save button, mirroring CharacterPicker's immediate-upload UX).
function ImageUploadField({
  label,
  kind,
  field,
  currentUrl,
  previewClassName,
}: {
  label: string;
  kind: string;
  field: 'logo_url' | 'favicon_url' | 'og_image_url';
  currentUrl?: string | null;
  previewClassName: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadSettingsImage();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const isBusy = uploadImage.isPending || updateSettings.isPending;

  const handleFileSelected = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    uploadImage.mutate(
      { file, kind },
      {
        onSuccess: ({ url }) => {
          updateSettings.mutate(
            { [field]: url },
            {
              onSuccess: () => {
                toast({ title: 'Tersimpan', description: `${label} berhasil diperbarui.` });
              },
              onError: (error) => {
                toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
              },
            }
          );
        },
        onError: (error) => {
          toast({ variant: 'destructive', title: 'Gagal upload', description: error.message });
        },
      }
    );
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center bg-muted rounded-lg overflow-hidden border border-border ${previewClassName}`}>
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt={label} className="w-full h-full object-contain" />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
          className="hidden"
          onChange={(e) => {
            handleFileSelected(e.target.files);
            e.target.value = '';
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
          {isBusy ? 'Mengupload...' : currentUrl ? 'Ganti' : 'Upload'}
        </Button>
      </div>
    </div>
  );
}

export function SettingsTab() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      show_category_filter: true,
      facebook_pixel_id: '',
      google_analytics_id: '',
    },
  });

  const brandingForm = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: {
      site_name: 'SEMUADA',
      site_tagline: '',
    },
  });

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      contact_email: '',
      contact_phone: '',
      contact_address: '',
      whatsapp_number: '',
      social_facebook_url: '',
      social_twitter_url: '',
      social_instagram_url: '',
    },
  });

  const seoForm = useForm<SeoFormValues>({
    resolver: zodResolver(seoFormSchema),
    defaultValues: {
      seo_meta_description: '',
    },
  });

  const maintenanceForm = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: {
      maintenance_mode: false,
      maintenance_message: '',
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        show_category_filter: settings.show_category_filter ?? true,
        facebook_pixel_id: settings.facebook_pixel_id || '',
        google_analytics_id: settings.google_analytics_id || '',
      });
      brandingForm.reset({
        site_name: settings.site_name || 'SEMUADA',
        site_tagline: settings.site_tagline || '',
      });
      contactForm.reset({
        contact_email: settings.contact_email || '',
        contact_phone: settings.contact_phone || '',
        contact_address: settings.contact_address || '',
        whatsapp_number: settings.whatsapp_number || '',
        social_facebook_url: settings.social_facebook_url || '',
        social_twitter_url: settings.social_twitter_url || '',
        social_instagram_url: settings.social_instagram_url || '',
      });
      seoForm.reset({
        seo_meta_description: settings.seo_meta_description || '',
      });
      maintenanceForm.reset({
        maintenance_mode: settings.maintenance_mode ?? false,
        maintenance_message: settings.maintenance_message || '',
      });
    }
  }, [settings, form, brandingForm, contactForm, seoForm, maintenanceForm]);

  const onSubmit = (data: SettingsFormValues) => {
    updateSettings.mutate(data, {
      onSuccess: () => {
        toast({ title: "Success", description: "Tracking settings have been updated." });
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Error", description: error.message });
      },
    });
  };

  const onSubmitBranding = (data: BrandingFormValues) => {
    updateSettings.mutate(data, {
      onSuccess: () => {
        toast({ title: "Tersimpan", description: "Identitas situs berhasil diperbarui." });
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Error", description: error.message });
      },
    });
  };

  const onSubmitContact = (data: ContactFormValues) => {
    updateSettings.mutate(data, {
      onSuccess: () => {
        toast({ title: "Tersimpan", description: "Info kontak & sosial media berhasil diperbarui." });
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Error", description: error.message });
      },
    });
  };

  const onSubmitSeo = (data: SeoFormValues) => {
    updateSettings.mutate(data, {
      onSuccess: () => {
        toast({ title: "Tersimpan", description: "Pengaturan SEO berhasil diperbarui." });
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Error", description: error.message });
      },
    });
  };

  const onSubmitMaintenance = (data: MaintenanceFormValues) => {
    updateSettings.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Tersimpan",
          description: data.maintenance_mode
            ? "Mode maintenance AKTIF -- website publik kini menampilkan halaman maintenance."
            : "Mode maintenance nonaktif -- website kembali normal.",
        });
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Error", description: error.message });
      },
    });
  };

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Store className="h-5 w-5 mr-2" />
          Identitas Situs
        </CardTitle>
        <CardDescription>
          Nama, tagline, logo, dan favicon yang tampil di seluruh halaman website.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading settings...</p>
        ) : (
          <Form {...brandingForm}>
            <form onSubmit={brandingForm.handleSubmit(onSubmitBranding)} className="space-y-6">
              <FormField
                control={brandingForm.control}
                name="site_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Website</FormLabel>
                    <FormControl>
                      <Input placeholder="SEMUADA" {...field} />
                    </FormControl>
                    <FormDescription>
                      Tampil di header, footer, dan judul tab browser.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={brandingForm.control}
                name="site_tagline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tagline</FormLabel>
                    <FormControl>
                      <Input placeholder="Temukan Produk Terbaik" {...field} />
                    </FormControl>
                    <FormDescription>
                      Deskripsi singkat yang tampil di footer.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <ImageUploadField
                  label="Logo"
                  kind="logo"
                  field="logo_url"
                  currentUrl={settings?.logo_url}
                  previewClassName="w-14 h-14"
                />
                <ImageUploadField
                  label="Favicon"
                  kind="favicon"
                  field="favicon_url"
                  currentUrl={settings?.favicon_url}
                  previewClassName="w-10 h-10"
                />
              </div>

              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? 'Menyimpan...' : 'Simpan Identitas Situs'}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageCircle className="h-5 w-5 mr-2" />
          Kontak & Sosial Media
        </CardTitle>
        <CardDescription>
          Info kontak dan link sosial media yang tampil di footer. Kosongkan field yang tidak ingin ditampilkan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading settings...</p>
        ) : (
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(onSubmitContact)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={contactForm.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="support@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactForm.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Phone className="h-4 w-4 mr-2" />
                        Telepon
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="+62 21 1234 5678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={contactForm.control}
                name="contact_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      Alamat
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Jakarta, Indonesia" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={contactForm.control}
                name="whatsapp_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Nomor WhatsApp
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="6281234567890 (format internasional, tanpa +)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Jika diisi, tombol chat WhatsApp mengambang akan tampil di seluruh halaman.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <FormField
                  control={contactForm.control}
                  name="social_facebook_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Facebook className="h-4 w-4 mr-2" />
                        Facebook
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://facebook.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactForm.control}
                  name="social_twitter_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Twitter className="h-4 w-4 mr-2" />
                        Twitter / X
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://x.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactForm.control}
                  name="social_instagram_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Instagram className="h-4 w-4 mr-2" />
                        Instagram
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://instagram.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? 'Menyimpan...' : 'Simpan Kontak & Sosial Media'}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Search className="h-5 w-5 mr-2" />
          SEO
        </CardTitle>
        <CardDescription>
          Kontrol bagaimana website tampil di hasil pencarian dan saat dibagikan ke social media.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading settings...</p>
        ) : (
          <Form {...seoForm}>
            <form onSubmit={seoForm.handleSubmit(onSubmitSeo)} className="space-y-6">
              <FormField
                control={seoForm.control}
                name="seo_meta_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Deskripsi singkat untuk hasil pencarian Google (maks ~160 karakter)." rows={3} {...field} />
                    </FormControl>
                    <FormDescription>
                      Jika kosong, tagline website akan dipakai sebagai deskripsi default.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ImageUploadField
                label="OG Image (gambar preview saat dibagikan)"
                kind="og-image"
                field="og_image_url"
                currentUrl={settings?.og_image_url}
                previewClassName="w-24 h-14"
              />

              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? 'Menyimpan...' : 'Simpan SEO'}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          Mode Maintenance
        </CardTitle>
        <CardDescription>
          Saat aktif, seluruh halaman publik (kecuali admin) menampilkan halaman maintenance. Dashboard admin tetap bisa diakses agar mode ini bisa dimatikan kembali.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading settings...</p>
        ) : (
          <Form {...maintenanceForm}>
            <form onSubmit={maintenanceForm.handleSubmit(onSubmitMaintenance)} className="space-y-6">
              <FormField
                control={maintenanceForm.control}
                name="maintenance_mode"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Aktifkan Mode Maintenance</FormLabel>
                      <FormDescription>
                        Pengunjung akan melihat halaman maintenance, bukan website normal.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={maintenanceForm.control}
                name="maintenance_message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pesan Maintenance</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Website sedang dalam perbaikan, kami akan segera kembali." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" variant={maintenanceForm.watch('maintenance_mode') ? 'destructive' : 'default'} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? 'Menyimpan...' : 'Simpan Mode Maintenance'}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Tracking Settings</CardTitle>
        <CardDescription>
          Manage your marketing and analytics tracking IDs here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading settings...</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="show_category_filter"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center">
                        <Folder className="h-4 w-4 mr-2" />
                        Filter Kategori
                      </FormLabel>
                      <FormDescription>
                        Tampilkan filter Kategori &gt; Subkategori &gt; Item di sidebar homepage.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="facebook_pixel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Facebook className="h-4 w-4 mr-2" />
                      Facebook Pixel ID
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your Facebook Pixel ID" {...field} />
                    </FormControl>
                    <FormDescription>
                      This ID will be used to track events with Facebook Pixel.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="google_analytics_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <MonitorSmartphone className="h-4 w-4 mr-2" />
                      Google Analytics ID
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your G- or UA- ID" {...field} />
                    </FormControl>
                    <FormDescription>
                      This ID will be used for Google Analytics tracking.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
    <AiProviderSettings />
    </div>
  );
}