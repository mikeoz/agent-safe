import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import RegisteredForms from "./pages/RegisteredForms";
import RegisterForm from "./pages/RegisterForm";
import CreateInstance from "./pages/CreateInstance";
import MyInstances from "./pages/MyInstances";
import PendingReviews from "./pages/PendingReviews";
import AuditTrail from "./pages/AuditTrail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route path="/forms" element={<RegisteredForms />} />
            <Route path="/forms/register" element={<RegisterForm />} />
            <Route path="/instances" element={<MyInstances />} />
            <Route path="/instances/create" element={<CreateInstance />} />
            <Route path="/reviews" element={<PendingReviews />} />
            <Route path="/audit" element={<AuditTrail />} />
          </Route>
          <Route path="/" element={<Navigate to="/forms" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
