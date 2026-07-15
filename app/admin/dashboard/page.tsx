"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Settings, Home, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductManagementTab } from "@/components/admin/ProductManagementTab";
import { FeaturedManagementTab } from "@/components/admin/FeaturedManagementTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { ContentGeneratorTab } from "@/components/admin/ContentGeneratorTab";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function AdminDashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/admin/login");
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald to-metallic rounded-xl flex items-center justify-center">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                  <p className="text-muted-foreground">Manage your e-commerce platform</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Button variant="outline" onClick={() => router.push("/")}><Home className="h-4 w-4 mr-2" />View Site</Button>
                <Button variant="outline" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Logout</Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Tabs defaultValue="products" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="featured">Featured</TabsTrigger>
              <TabsTrigger value="content-generator">Content Generator</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <ErrorBoundary>
                <ProductManagementTab />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="featured">
              <ErrorBoundary>
                <FeaturedManagementTab />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="content-generator">
              <ErrorBoundary>
                <ContentGeneratorTab />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="analytics">
              <ErrorBoundary>
                <AnalyticsTab />
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="settings">
              <ErrorBoundary>
                <SettingsTab />
              </ErrorBoundary>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ErrorBoundary>
  );
}
