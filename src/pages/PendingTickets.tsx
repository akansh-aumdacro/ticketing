import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { SLAIndicator } from "@/components/SLAIndicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { statusMap } from "@/lib/mock-data";
import { Search, Clock, UserPlus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useDeleteTicket } from "@/hooks/useDeleteTicket";

export default function PendingTickets() {
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const isSuperOrAdmin = role === "super_admin" || role === "admin";
  const isHOD = role === "hod";
  const { isSuperAdmin, deleteTicket } = useDeleteTicket();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["pending-tickets", user?.id, role, profile?.department_id],
    queryFn: async () => {
      const params: Record<string, string | boolean> = { status: "open,reopened" };
      if (role === "user") {
        params.mine = true;
      } else if ((role === "assigned_person" || isHOD) && profile?.department_id) {
        params.department = profile.department_id;
      }
      // admin/super_admin see all
      return api.tickets.list(params);
    },
    enabled: !!user,
  });

  // Fetch team members (assigned_person) in the HOD's department for assignment.
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members", profile?.department_id],
    queryFn: async () => {
      const profiles = await api.profiles.list({ department_id: profile!.department_id!, role: "assigned_person" });
      return (profiles as any[]).filter((p) => p.user_id !== user!.id);
    },
    enabled: isHOD && !!profile?.department_id,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ ticketId, assigneeId }: { ticketId: string; assigneeId: string }) => {
      await api.tickets.update(ticketId, { assigned_to: assigneeId, status: "in_progress" });

      // Add history
      await api.tickets.addHistory(ticketId, {
        action: "Assigned ticket",
        old_status: "open",
        new_status: "in_progress",
      });

      // Notification
      await api.notifications.create({
        user_id: assigneeId,
        title: "Ticket Assigned",
        message: "A ticket has been assigned to you.",
        ticket_id: ticketId,
        type: "assignment",
      });
    },
    onSuccess: () => {
      toast({ title: "Ticket Assigned", description: "Ticket has been assigned and moved to In Progress." });
      queryClient.invalidateQueries({ queryKey: ["pending-tickets"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = (tickets || []).filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.ticket_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppLayout title="Pending Tickets">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search pending tickets..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
            <Clock className="h-4 w-4 text-warning" />
            <span>{filtered.length} pending ticket{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No pending tickets.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((ticket) => (
            <Card key={ticket.id} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/ticket/${ticket.id}`)}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-primary font-semibold">{ticket.ticket_number}</span>
                      <StatusBadge status={statusMap[ticket.status]} />
                      <PriorityBadge priority={ticket.priority || "medium"} />
                    </div>
                    <h3 className="font-medium text-foreground truncate">{ticket.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>From: {(ticket as any).raiser?.name || "—"}</span>
                      <span>Dept: {(ticket as any).issue_dept?.name || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ticket.target_date && (
                      <div className="text-right space-y-1">
                        <p className="text-xs text-muted-foreground">Target: {new Date(ticket.target_date).toLocaleDateString()}</p>
                        <SLAIndicator targetDate={ticket.target_date} status={ticket.status} />
                      </div>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTicket(ticket.id); }}
                        className="text-destructive hover:bg-destructive/10 rounded p-1.5"
                        title="Delete ticket"
                        aria-label="Delete ticket"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {isHOD && !ticket.assigned_to && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="ml-2">
                            <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2">
                          <p className="text-xs font-medium mb-2 text-muted-foreground">Assign to team member</p>
                          {teamMembers?.length ? teamMembers.map((m) => (
                            <button
                              key={m.user_id}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm text-left"
                              onClick={() => assignMutation.mutate({ ticketId: ticket.id, assigneeId: m.user_id })}
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{m.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                              </Avatar>
                              {m.name}
                            </button>
                          )) : (
                            <p className="text-xs text-muted-foreground py-2">No team members found.</p>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppLayout>
  );
}
