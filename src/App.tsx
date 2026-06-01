import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Analytics from "./pages/Analytics";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import CreateTicket from "./pages/CreateTicket";
import MyTickets from "./pages/MyTickets";
import TicketDetail from "./pages/TicketDetail";
import PendingTickets from "./pages/PendingTickets";
import AssignedTickets from "./pages/AssignedTickets";
import DepartmentTickets from "./pages/DepartmentTickets";
import Reports from "./pages/Reports";
import ManageUsers from "./pages/ManageUsers";
import Settings from "./pages/Settings";
import PCReview from "./pages/PCReview";
import MyProfile from "./pages/MyProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PermissionsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute permissionKey="analytics"><Analytics /></ProtectedRoute>} />
            <Route path="/create-ticket" element={<ProtectedRoute permissionKey="createTicket"><CreateTicket /></ProtectedRoute>} />
            <Route path="/my-tickets" element={<ProtectedRoute permissionKey="myTickets"><MyTickets /></ProtectedRoute>} />
            <Route path="/ticket/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />
            <Route path="/pending-tickets" element={<ProtectedRoute permissionKey="pendingTickets"><PendingTickets /></ProtectedRoute>} />
            <Route path="/assigned-tickets" element={<ProtectedRoute permissionKey="assignedTickets"><AssignedTickets /></ProtectedRoute>} />
            <Route path="/department-tickets" element={<ProtectedRoute permissionKey="departmentTickets"><DepartmentTickets /></ProtectedRoute>} />
            <Route path="/pc-review" element={<ProtectedRoute permissionKey="pcReview"><PCReview /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute permissionKey="summary"><Reports /></ProtectedRoute>} />
            <Route path="/manage-users" element={<ProtectedRoute permissionKey="manageUsers"><ManageUsers /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute permissionKey="settings"><Settings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PermissionsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
