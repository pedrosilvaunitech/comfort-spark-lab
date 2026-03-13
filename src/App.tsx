import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LicenseProvider } from "@/contexts/LicenseContext";

// Eager-load the landing page only
import Index from "./pages/Index";

// Lazy-load all other pages
const Totem = lazy(() => import("./pages/Totem"));
const Panel = lazy(() => import("./pages/Panel"));
const Counter = lazy(() => import("./pages/Counter"));
const Admin = lazy(() => import("./pages/Admin"));
const Login = lazy(() => import("./pages/Login"));
const SetupAdmin = lazy(() => import("./pages/SetupAdmin"));
const LicenseSettings = lazy(() => import("./pages/LicenseSettings"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Install = lazy(() => import("./pages/Install"));
const TotemSetup = lazy(() => import("./pages/TotemSetup"));
const Suporte = lazy(() => import("./pages/Suporte"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Carregando...</div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LicenseProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/totem" element={<Totem />} />
              <Route path="/totem/setup" element={<TotemSetup />} />
              <Route path="/totem-setup" element={<TotemSetup />} />
              <Route path="/panel" element={<Panel />} />
              <Route path="/oanel" element={<Panel />} />
              <Route path="/painel" element={<Panel />} />
              <Route path="/counter" element={<Counter />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/setup" element={<SetupAdmin />} />
              <Route path="/license-settings" element={<LicenseSettings />} />
              <Route path="/install" element={<Install />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/suporte" element={<Suporte />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </LicenseProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
