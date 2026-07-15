import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAiSettings, useUpdateAiSettings, useTestAiConnection } from "@/hooks/useAiSettings";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, CheckCircle2 } from 'lucide-react';

const aiSettingsFormSchema = z.object({
  gemini_api_key: z.string().optional(),
  gemini_model: z.string(),
  groq_api_key: z.string().optional(),
  openrouter_api_key: z.string().optional(),
  deepseek_api_key: z.string().optional(),
  narration_wpm: z.coerce.number().min(60).max(400),
});

type AiSettingsFormValues = z.infer<typeof aiSettingsFormSchema>;

const GEMINI_MODELS = [
  { value: 'gemini-flash-latest', label: 'Gemini Flash Latest (disarankan, cepat, limit gratis besar)' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (paling hemat kuota)' },
];

const PROVIDERS = [
  { key: 'gemini_api_key' as const, provider: 'gemini' as const, label: 'Gemini API Key', hasKeyField: 'has_gemini_key' as const },
  { key: 'groq_api_key' as const, provider: 'groq' as const, label: 'Groq API Key', hasKeyField: 'has_groq_key' as const },
  { key: 'openrouter_api_key' as const, provider: 'openrouter' as const, label: 'OpenRouter API Key', hasKeyField: 'has_openrouter_key' as const },
  { key: 'deepseek_api_key' as const, provider: 'deepseek' as const, label: 'DeepSeek API Key', hasKeyField: 'has_deepseek_key' as const },
];

export function AiProviderSettings() {
  const { data: aiSettings, isLoading } = useAiSettings();
  const updateAiSettings = useUpdateAiSettings();
  const testConnection = useTestAiConnection();
  const { toast } = useToast();
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const form = useForm<AiSettingsFormValues>({
    resolver: zodResolver(aiSettingsFormSchema),
    defaultValues: { gemini_api_key: '', gemini_model: 'gemini-flash-latest', groq_api_key: '', openrouter_api_key: '', deepseek_api_key: '', narration_wpm: 180 },
  });

  useEffect(() => {
    if (aiSettings) {
      form.reset({
        gemini_api_key: '',
        gemini_model: aiSettings.gemini_model || 'gemini-flash-latest',
        groq_api_key: '',
        openrouter_api_key: '',
        deepseek_api_key: '',
        narration_wpm: aiSettings.narration_wpm || 180,
      });
    }
  }, [aiSettings, form]);

  const onSubmit = (data: AiSettingsFormValues) => {
    // Blank fields mean "keep existing key" -- strip them so we don't
    // overwrite a saved key with an empty string.
    const payload = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== ''));
    updateAiSettings.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Tersimpan", description: "Pengaturan AI provider berhasil disimpan." });
        form.reset({ ...form.getValues(), gemini_api_key: '', groq_api_key: '', openrouter_api_key: '', deepseek_api_key: '' });
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Error", description: error.message });
      },
    });
  };

  const handleTest = async (provider: 'gemini' | 'groq' | 'openrouter' | 'deepseek') => {
    setTestingProvider(provider);
    try {
      const result = await testConnection.mutateAsync(provider);
      toast({
        variant: result.ok ? 'default' : 'destructive',
        title: result.ok ? 'Koneksi berhasil' : 'Koneksi gagal',
        description: result.message,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="h-4 w-4 mr-2" />
          Content Generator — AI Provider
        </CardTitle>
        <CardDescription>
          API key disimpan aman di server, tidak pernah dikirim ke browser setelah disimpan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="gemini_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Gemini</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GEMINI_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="narration_wpm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kecepatan Narasi (WPM)</FormLabel>
                    <FormControl>
                      <Input type="number" min={60} max={400} {...field} />
                    </FormControl>
                    <FormDescription>Target kata per menit untuk narasi -- default 180 (cepat tapi jelas untuk Bahasa Indonesia).</FormDescription>
                  </FormItem>
                )}
              />

              {PROVIDERS.map(({ key, provider, label, hasKeyField }) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={key}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        {label}
                        {aiSettings?.[hasKeyField] && (
                          <span className="inline-flex items-center text-xs text-emerald-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> tersimpan
                          </span>
                        )}
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={aiSettings?.[hasKeyField] ? "•••••••• (biarkan kosong jika tidak ganti)" : "Masukkan API key"}
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!aiSettings?.[hasKeyField] || testingProvider === provider}
                          onClick={() => handleTest(provider)}
                        >
                          {testingProvider === provider ? 'Testing...' : 'Test Koneksi'}
                        </Button>
                      </div>
                      <FormDescription />
                    </FormItem>
                  )}
                />
              ))}

              <Button type="submit" disabled={updateAiSettings.isPending}>
                {updateAiSettings.isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
