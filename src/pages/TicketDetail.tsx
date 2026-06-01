import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { SLAIndicator } from "@/components/SLAIndicator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { statusMap } from "@/lib/mock-data";
import {
  ArrowLeft, User, Calendar, Building2, Clock, MessageSquare, Star,
  CheckCircle2, RotateCcw, UserPlus, Image, AlertTriangle, Upload, X, FileText, Trash2,
} from "lucide-react";
import { useDeleteTicket } from "@/hooks/useDeleteTicket";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TicketChatThread } from "@/components/TicketChatThread";
import { Badge } from "@/components/ui/badge";


export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperAdmin, deleteTicket } = useDeleteTicket();
  const [remarks, setRemarks] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [nextTargetDate, setNextTargetDate] = useState("");

  // Reopen modal state
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenRemarks, setReopenRemarks] = useState("");
  const [reopenFiles, setReopenFiles] = useState<File[]>([]);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("*, issue_dept:departments!tickets_issue_department_id_fkey(name), dept:departments!tickets_department_id_fkey(name), unit:units(name), raiser:profiles!tickets_raised_by_fkey(name, employee_id, contact, department_id), assigned_profile:profiles!tickets_assigned_to_fkey(name, employee_id, contact), closed_by_profile:profiles!tickets_closed_by_fkey(name)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: history } = useQuery({
    queryKey: ["ticket-history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_history")
        .select("*, performer:profiles!ticket_history_performed_by_fkey(name)")
        .eq("ticket_id", id!)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: deptMembers } = useQuery({
    queryKey: ["dept-members", ticket?.issue_department_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("department_id", ticket!.issue_department_id!);
      return data || [];
    },
    enabled: !!ticket?.issue_department_id && (role === "hod" || role === "super_admin" || role === "admin"),
  });

  const { data: ticketRating } = useQuery({
    queryKey: ["ticket-rating", id],
    queryFn: async () => {
      const { data } = await supabase.from("ticket_ratings").select("*").eq("ticket_id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    queryClient.invalidateQueries({ queryKey: ["ticket-history", id] });
    queryClient.invalidateQueries({ queryKey: ["ticket-rating", id] });
  };

  const updateTicket = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("tickets").update(updates as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addHistory = async (action: string, oldStatus?: string, newStatus?: string, histRemarks?: string) => {
    await supabase.from("ticket_history").insert({
      ticket_id: id!,
      action,
      performed_by: user!.id,
      old_status: oldStatus as any,
      new_status: newStatus as any,
      remarks: histRemarks,
    });
  };

  const handleAssign = async () => {
    if (!assignTo) {
      toast({ title: "Team member required", description: "Please select a team member.", variant: "destructive" });
      return;
    }
    if (!targetDate) {
      toast({ title: "Target date required", description: "Please select a target date.", variant: "destructive" });
      return;
    }
    const updates: Record<string, any> = { assigned_to: assignTo, status: "in_progress", target_date: targetDate };
    await updateTicket.mutateAsync(updates);
    const memberName = deptMembers?.find(m => m.user_id === assignTo)?.name;
    await addHistory(`Assigned to ${memberName}`, ticket!.status, "in_progress");
    await supabase.from("user_roles").upsert({ user_id: assignTo, role: "assigned_person" as any }, { onConflict: "user_id,role" });
    // Notification
    await supabase.from("notifications").insert({
      user_id: assignTo,
      ticket_id: id!,
      title: "Ticket Assigned",
      message: `You have been assigned ticket ${ticket!.ticket_number}`,
      type: "assignment",
    });
    toast({ title: "Ticket assigned" });
    setAssignTo("");
    setTargetDate("");
  };

  const handleSetTargetDate = async () => {
    if (!nextTargetDate) return;
    await updateTicket.mutateAsync({ next_target_date: nextTargetDate, remarks });
    await addHistory("Updated target date to " + nextTargetDate, undefined, undefined, remarks);
    setNextTargetDate("");
    setRemarks("");
    toast({ title: "Target date updated" });
  };

  const handleResolve = async () => {
    await updateTicket.mutateAsync({ status: "resolved", remarks });
    await addHistory("Marked as Resolved", ticket!.status, "resolved", remarks);
    // Notify raiser
    await supabase.from("notifications").insert({
      user_id: ticket!.raised_by,
      ticket_id: id!,
      title: "Ticket Resolved",
      message: `Ticket ${ticket!.ticket_number} has been resolved`,
      type: "status_change",
    });
    setRemarks("");
    toast({ title: "Ticket marked as resolved" });
  };

  const handleClose = async () => {
    await updateTicket.mutateAsync({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user!.id,
      closing_remarks: remarks,
    });
    await addHistory("Ticket Closed", ticket!.status, "closed", remarks);
    await supabase.from("notifications").insert({
      user_id: ticket!.raised_by,
      ticket_id: id!,
      title: "Ticket Closed",
      message: `Ticket ${ticket!.ticket_number} has been closed`,
      type: "status_change",
    });
    setRemarks("");
    toast({ title: "Ticket closed" });
  };

  const handleReopen = async () => {
    if (reopenRemarks.length < 20) {
      toast({ title: "Error", description: "Please provide at least 20 characters explaining why.", variant: "destructive" });
      return;
    }

    let reopenPhotoUrl: string | null = null;
    if (reopenFiles.length > 0) {
      const file = reopenFiles[0];
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/reopen-${Date.now()}.${ext}`;
      const { data: uploadData } = await supabase.storage.from("ticket-attachments").upload(path, file);
      if (uploadData) {
        const { data: urlData } = supabase.storage.from("ticket-attachments").getPublicUrl(uploadData.path);
        reopenPhotoUrl = urlData.publicUrl;
      }
    }

    await updateTicket.mutateAsync({
      status: "reopened",
      reopened_at: new Date().toISOString(),
      reopen_remarks: reopenRemarks,
      reopen_photo_url: reopenPhotoUrl,
    });
    await addHistory("Ticket Reopened", ticket!.status, "reopened", reopenRemarks);
    // Notify assigned person
    if (ticket!.assigned_to) {
      await supabase.from("notifications").insert({
        user_id: ticket!.assigned_to,
        ticket_id: id!,
        title: "Ticket Reopened",
        message: `Ticket ${ticket!.ticket_number} has been reopened`,
        type: "reopen",
      });
    }
    setReopenRemarks("");
    setReopenFiles([]);
    setReopenOpen(false);
    toast({ title: "Ticket reopened successfully" });
  };

  const handleRating = async () => {
    const { error } = await supabase.from("ticket_ratings").insert({
      ticket_id: id!,
      rated_by: user!.id,
      rating,
      feedback: feedback || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Thank you for your feedback!" });
      invalidate();
    }
  };

  const handleReopenFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setReopenFiles(Array.from(e.target.files));
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  if (!ticket) {
    return (
      <AppLayout title="Ticket Not Found">
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground">Ticket not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  const isElevated = role === "super_admin" || role === "admin";
  const isHOD = role === "hod" || isElevated;
  const isAssigned = ticket.assigned_to === user?.id || isElevated;
  const isRaiser = ticket.raised_by === user?.id;
  const displayStatus = statusMap[ticket.status];
  const isOverdue = ticket.target_date && new Date(ticket.target_date) < new Date() && ticket.status !== "closed";

  const priorityBorderColor: Record<string, string> = {
    critical: "border-l-red-500",
    high: "border-l-orange-500",
    medium: "border-l-yellow-500",
    low: "border-l-green-500",
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{ticket.title}</h1>
              <StatusBadge status={displayStatus} />
              <PriorityBadge priority={(ticket as any).priority || "medium"} />
              {isOverdue && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  <AlertTriangle className="h-3 w-3" /> SLA BREACHED
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-1">{ticket.ticket_number}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {((isAssigned && ticket.status === "in_progress") || (isElevated && !["resolved", "closed"].includes(ticket.status))) && (
              <Button size="sm" onClick={handleResolve}><CheckCircle2 className="h-4 w-4 mr-1" /> Resolve</Button>
            )}
            {((isHOD && ticket.status === "resolved") || (isElevated && ticket.status !== "closed")) && (
              <Button size="sm" onClick={handleClose}><CheckCircle2 className="h-4 w-4 mr-1" /> Close Ticket</Button>
            )}
            {isRaiser && ticket.status === "closed" && (
              <Button size="sm" variant="outline" onClick={() => setReopenOpen(true)}><RotateCcw className="h-4 w-4 mr-1" /> Reopen</Button>
            )}
            {isSuperAdmin && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  deleteTicket(ticket.id);
                  // Navigate back after a short delay so the optimistic cache update + delete fires
                  setTimeout(() => navigate(-1), 100);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete Ticket
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details & Activity</TabsTrigger>
                <TabsTrigger value="thread" className="flex items-center gap-2">
                  Thread
                  <span className={`h-2 w-2 rounded-full ${["resolved","closed"].includes(ticket.status) ? "bg-muted-foreground/40" : "bg-emerald-500 animate-pulse"}`} />
                </TabsTrigger>
              </TabsList>
              <TabsContent value="thread" className="mt-4">
                <TicketChatThread
                  ticketId={ticket.id}
                  ticketStatus={ticket.status}
                  raisedBy={ticket.raised_by}
                  assignedTo={ticket.assigned_to}
                />
              </TabsContent>
              <TabsContent value="details" className="mt-4 space-y-6">

            {/* Description */}
            <Card className={`border shadow-sm border-l-4 ${priorityBorderColor[(ticket as any).priority || "medium"]}`}>
              <CardHeader><CardTitle className="text-sm font-semibold">Description</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{ticket.description || "No description provided."}</p>
                {(() => {
                  const list: string[] = Array.isArray((ticket as any).attachments) && (ticket as any).attachments.length > 0
                    ? (ticket as any).attachments
                    : ticket.photo_url ? [ticket.photo_url] : [];
                  if (list.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Image className="h-3 w-3" /> Attachments ({list.length})
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        {list.map((url, i) => {
                          const isPdf = url.toLowerCase().includes(".pdf");
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block h-24 w-24 rounded-lg border bg-muted overflow-hidden hover:ring-2 hover:ring-primary transition-all"
                            >
                              {isPdf ? (
                                <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                                  <FileText className="h-7 w-7" />
                                  <span className="text-[10px] mt-1">PDF</span>
                                </div>
                              ) : (
                                <img src={url} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
                              )}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Assign section for HOD */}
            {isHOD && (ticket.status === "open" || ticket.status === "reopened") && deptMembers && deptMembers.length > 0 && (
              <Card className="border shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold">Assign Ticket</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-3">
                    <Select value={assignTo} onValueChange={setAssignTo} required>
                      <SelectTrigger className="flex-1" aria-required="true"><SelectValue placeholder="Select team member *" /></SelectTrigger>
                      <SelectContent>
                        {deptMembers.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="w-40">
                      <Input type="date" required aria-required="true" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                    </div>
                    <Button onClick={handleAssign} disabled={!assignTo || !targetDate}><UserPlus className="h-4 w-4 mr-1" /> Assign</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Both team member and target date are required.</p>
                </CardContent>
              </Card>
            )}

            {/* Set next target date */}
            {isAssigned && ticket.status === "in_progress" && (
              <Card className="border shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold">Update Target Date</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-3">
                    <Input type="date" value={nextTargetDate} onChange={(e) => setNextTargetDate(e.target.value)} className="w-48" />
                    <Button variant="outline" onClick={handleSetTargetDate} disabled={!nextTargetDate}>Update</Button>
                  </div>
                  <Textarea placeholder="Reason for date change..." rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card className="border shadow-sm">
              <CardHeader><CardTitle className="text-sm font-semibold">Activity Timeline</CardTitle></CardHeader>
              <CardContent>
                {(history || []).length > 0 ? (
                  <div className="space-y-0">
                    {history!.map((item, i) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                            <Clock className="h-4 w-4" />
                          </div>
                          {i < history!.length - 1 && <div className="w-px h-full bg-border min-h-[24px]" />}
                        </div>
                        <div className="pb-6">
                          <p className="text-sm font-medium">{item.action}</p>
                          <p className="text-xs text-muted-foreground">
                            by {(item as any).performer?.name} • {new Date(item.created_at).toLocaleString()}
                          </p>
                          {item.remarks && <p className="text-sm text-muted-foreground mt-1 bg-muted/50 rounded-md p-2">{item.remarks}</p>}
                          {item.new_status && <div className="mt-1"><StatusBadge status={statusMap[item.new_status]} /></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Add Remarks removed */}

            {/* Rating */}
            {ticket.status === "closed" && isRaiser && (
              <Card className="border shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold">Feedback & Rating</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {ticketRating ? (
                    <>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`h-5 w-5 ${s <= ticketRating.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                        ))}
                        <span className="text-sm text-muted-foreground ml-2">{ticketRating.rating}/5</span>
                      </div>
                      {ticketRating.feedback && <p className="text-sm text-muted-foreground italic">"{ticketRating.feedback}"</p>}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(s => (
                          <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(s)}>
                            <Star className={`h-6 w-6 transition-colors ${s <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                          </button>
                        ))}
                      </div>
                      <Textarea placeholder="Optional feedback..." rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={handleRating} disabled={rating === 0}>Submit Feedback</Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reopen info */}
            {ticket.reopen_remarks && (
              <Card className="border border-red-200 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold text-red-700">Reopen Details</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">{ticket.reopen_remarks}</p>
                  {ticket.reopened_at && <p className="text-xs text-muted-foreground">Reopened: {new Date(ticket.reopened_at).toLocaleString()}</p>}
                  {ticket.reopen_photo_url && (
                    <img src={ticket.reopen_photo_url} alt="Reopen attachment" className="rounded-lg border max-h-48 object-cover mt-2" />
                  )}
                </CardContent>
              </Card>
            )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="border shadow-sm">
              <CardHeader><CardTitle className="text-sm font-semibold">Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <DetailRow icon={<Building2 className="h-4 w-4" />} label="Unit" value={(ticket as any).unit?.name || "—"} />
                <DetailRow icon={<Building2 className="h-4 w-4" />} label="Issue Dept" value={(ticket as any).issue_dept?.name || "—"} />
                <DetailRow icon={<Calendar className="h-4 w-4" />} label="Raised" value={new Date(ticket.created_at).toLocaleString()} />
                {ticket.target_date && (
                  <div>
                    <DetailRow icon={<Calendar className="h-4 w-4" />} label="Target Date" value={new Date(ticket.target_date).toLocaleDateString()} />
                    <div className="ml-7 mt-1"><SLAIndicator targetDate={ticket.target_date} status={ticket.status} /></div>
                  </div>
                )}
                {ticket.next_target_date && <DetailRow icon={<Calendar className="h-4 w-4" />} label="Next Target" value={new Date(ticket.next_target_date).toLocaleDateString()} />}
                {ticket.closed_at && <DetailRow icon={<Calendar className="h-4 w-4" />} label="Closed" value={new Date(ticket.closed_at).toLocaleString()} />}
                {(ticket as any).closed_by_profile?.name && <DetailRow icon={<User className="h-4 w-4" />} label="Closed By" value={(ticket as any).closed_by_profile.name} />}
                {ticket.closing_remarks && <DetailRow icon={<MessageSquare className="h-4 w-4" />} label="Closing Remarks" value={ticket.closing_remarks} />}
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader><CardTitle className="text-sm font-semibold">Raised By</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm font-medium">{(ticket as any).raiser?.name || "—"}</p>
                <p className="text-xs text-muted-foreground">{(ticket as any).raiser?.employee_id || ""}</p>
                <p className="text-xs text-muted-foreground">{(ticket as any).raiser?.contact || ""}</p>
              </CardContent>
            </Card>

            {(ticket as any).assigned_profile && (
              <Card className="border shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold">Assigned To</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm font-medium">{(ticket as any).assigned_profile.name}</p>
                  <p className="text-xs text-muted-foreground">{(ticket as any).assigned_profile.employee_id || ""}</p>
                </CardContent>
              </Card>
            )}

            {ticket.remarks && (
              <Card className="border shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold">Latest Remarks</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{ticket.remarks}</p></CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Reopen Modal */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reopen Ticket — {ticket?.ticket_number}</DialogTitle>
            <DialogDescription>Please explain why this ticket needs to be reopened.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason / Remarks *</Label>
              <Textarea
                value={reopenRemarks}
                onChange={e => setReopenRemarks(e.target.value)}
                placeholder="Please explain why this ticket needs to be reopened (min 20 characters)"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">{reopenRemarks.length}/20 minimum characters</p>
            </div>
            <div className="space-y-2">
              <Label>Attachments (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleReopenFileChange}
                />
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop or <span className="text-primary font-medium">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF accepted</p>
              </div>
              {reopenFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {reopenFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                      <span className="truncate max-w-[120px]">{f.name}</span>
                      <button onClick={() => setReopenFiles(reopenFiles.filter((_, idx) => idx !== i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenOpen(false)}>Cancel</Button>
            <Button onClick={handleReopen} disabled={reopenRemarks.length < 20}>Reopen Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
