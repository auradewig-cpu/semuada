import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings"; // Assuming BarChart3 is not used elsewhere
import { useToast } from "@/hooks/use-toast";
import { Facebook, MonitorSmartphone, Folder } from 'lucide-react';
import { AiProviderSettings } from "@/components/admin/AiProviderSettings";

const settingsFormSchema = z.object({
  show_category_filter: z.boolean(),
  facebook_pixel_id: z.string().optional(),
  google_analytics_id: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

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

  useEffect(() => {
    if (settings) {
      form.reset({
        show_category_filter: settings.show_category_filter ?? true,
        facebook_pixel_id: settings.facebook_pixel_id || '',
        google_analytics_id: settings.google_analytics_id || '',
      });
    }
  }, [settings, form]);

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

  return (
    <div className="space-y-6">
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