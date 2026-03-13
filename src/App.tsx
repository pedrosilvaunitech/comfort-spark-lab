import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LicenseProvider } from "@/contexts/LicenseContext";
import Index from "./pages/Index";
import Totem from "./pages/Totem";
import Panel from "./pages/Panel";
import Counter from "./pages/Counter";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import SetupAdmin from "./pages/SetupAdmin";
import LicenseSettings from "./pages/LicenseSettings";
import Financeiro from "./pages/Financeiro";
import Install from "./pages/Install";
import TotemSetup from "./pages/TotemSetup";
import Suporte from "./pages/Suporte";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LicenseProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/totem" element={<Totem />} />
            <Route path="/totem/setup" element={<TotemSetup />} />
            <Route path="/totem-setup" element={<TotemSetup />} />
            <Route path="/counter" element={<Counter />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/setup" element={<SetupAdmin />} />
            <Route path="/license-settings" element={<LicenseSettings />} />
            <Route path="/install" element={<Install />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/suporte" element={<Suporte />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </LicenseProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
