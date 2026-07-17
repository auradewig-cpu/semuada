"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Settings,
  Home,
  LogOut,
  Package,
  Star,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ProductManagementTab } from "@/components/admin/ProductManagementTab";
import { FeaturedManagementTab } from "@/components/admin/FeaturedManagementTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { ContentGeneratorTab } from "@/components/admin/ContentGeneratorTab";
import ErrorBoundary from "@/components/ErrorBoundary";

const NAV_ITEMS = [
  { value: "products", label: "Products", icon: Package },
  { value: "featured", label: "Featured", icon: Star },
  { value: "content-generator", label: "Content Generator", icon: Sparkles },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "settings", label: "Settings", icon: Settings },
] as const;

type TabValue = (typeof NAV_ITEMS)[number]["value"];

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabValue>("products");

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/admin/login");
  };

  return (
    <ErrorBoundary>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-emerald to-metallic rounded-lg flex items-center justify-center">
                <Settings className="h-4 w-4 text-white" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-bold leading-tight">Admin Dashboard</p>
                <p className="text-xs text-muted-foreground leading-tight">Daftar Product</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
                    <SidebarMenuItem key={value}>
                      <SidebarMenuButton
                        isActive={activeTab === value}
                        tooltip={label}
                        onClick={() => setActiveTab(value)}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset>
          <header className="bg-card border-b border-border">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <h1 className="text-xl font-bold">
                    {NAV_ITEMS.find((item) => item.value === activeTab)?.label}
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <Button variant="outline" onClick={() => router.push("/")}><Home className="h-4 w-4 mr-2" />View Site</Button>
                  <Button variant="outline" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Logout</Button>
                </div>
              </div>
            </div>
          </header>

          <main className="p-4 md:p-8">
            {activeTab === "products" && (
              <ErrorBoundary>
                <ProductManagementTab />
              </ErrorBoundary>
            )}

            {activeTab === "featured" && (
              <ErrorBoundary>
                <FeaturedManagementTab />
              </ErrorBoundary>
            )}

            {activeTab === "content-generator" && (
              <ErrorBoundary>
                <ContentGeneratorTab />
              </ErrorBoundary>
            )}

            {activeTab === "analytics" && (
              <ErrorBoundary>
                <AnalyticsTab />
              </ErrorBoundary>
            )}

            {activeTab === "settings" && (
              <ErrorBoundary>
                <SettingsTab />
              </ErrorBoundary>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ErrorBoundary>
  );
}
