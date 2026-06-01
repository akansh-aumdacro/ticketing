import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Super-admin only ticket delete. The server cascades cleanup of dependent rows
 * (history, messages, ratings, attachments, notifications). Optimistically
 * removes the ticket from any cached `tickets` lists.
 */
export function useDeleteTicket() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = role === "super_admin";

  const mutation = useMutation({
    mutationFn: async (ticketId: string) => {
      if (!isSuperAdmin) throw new Error("Only Super Admins can delete tickets.");
      await api.tickets.remove(ticketId);
      return ticketId;
    },
    onMutate: async (ticketId: string) => {
      // Snapshot + optimistic removal across all ticket-list query caches.
      const snapshots: Array<[readonly unknown[], unknown]> = [];
      const queries = queryClient.getQueriesData<any[]>({ predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === "string" && (
          k === "my-tickets" || k === "pending-tickets" ||
          k === "assigned-tickets" || k === "dept-tickets"
        );
      }});
      for (const [key, data] of queries) {
        snapshots.push([key, data]);
        if (Array.isArray(data)) {
          queryClient.setQueryData(key, data.filter((t: any) => t?.id !== ticketId));
        }
      }
      return { snapshots };
    },
    onError: (err: Error, _id, context) => {
      // Rollback
      context?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Ticket deleted permanently" });
    },
  });

  const deleteTicket = (ticketId: string) => {
    if (!isSuperAdmin) return;
    const confirmed = window.confirm(
      "Permanently delete this ticket? This action cannot be undone."
    );
    if (!confirmed) return;
    mutation.mutate(ticketId);
  };

  return { isSuperAdmin, deleteTicket, isDeleting: mutation.isPending };
}
