import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { getRuntimeProfile } from "@/lib/runtimeProfile";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ProjectSettings from "./pages/ProjectSettings";
import Reports from "./pages/Reports";
import PeopleManagement from "./pages/PeopleManagement";
import Admin from "./pages/Admin";
import CompanyPortal from "./pages/CompanyPortal";
import UserRegistration from "./pages/UserRegistration";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Visitors from "./pages/Visitors";
import { ProtectedRoute } from "./components/ProtectedRoute";

const AccessControl = React.lazy(() => import('./pages/AccessControl'));
import { MainLayout } from "./components/layouts/MainLayout";
import { AuthProvider } from "@/contexts/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedPage = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string | string[] }) => (
  <ProtectedRoute requiredRole={requiredRole}>
    <MainLayout>{children}</MainLayout>
  </ProtectedRoute>
);

const App = () => {
  const isDesktop = getRuntimeProfile().isDesktop || window.location.protocol === 'file:';
  const Router = isDesktop ? HashRouter : BrowserRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Router>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<UserRegistration />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedPage><Index /></ProtectedPage>} />
                <Route path="/reports" element={<ProtectedPage><Reports /></ProtectedPage>} />
                <Route path="/people/*" element={<ProtectedPage><PeopleManagement /></ProtectedPage>} />
                <Route path="/admin/*" element={<ProtectedPage requiredRole="admin"><Admin /></ProtectedPage>} />
                <Route path="/company-portal/*" element={<ProtectedPage><CompanyPortal /></ProtectedPage>} />
                <Route path="/settings" element={<ProtectedPage requiredRole="admin"><ProjectSettings /></ProtectedPage>} />
                <Route path="/visitors" element={<ProtectedPage><Visitors /></ProtectedPage>} />
                <Route path="/access-control" element={<ProtectedPage requiredRole={['admin', 'operator']}><React.Suspense fallback={<div className="flex items-center justify-center min-h-screen">Carregando...</div>}><AccessControl /></React.Suspense></ProtectedPage>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
