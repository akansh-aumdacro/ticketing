import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Send } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { AttachmentDropzone, AttachmentItem } from "@/components/AttachmentDropzone";

export default function CreateTicket() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitId, setUnitId] = useState("");
  const [issueDeptId, setIssueDeptId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => api.units.list(),
  });

  // Auto-fill unit from user's profile (user can still change it)
  useEffect(() => {
    if (!unitId && (profile as any)?.unit_id) {
      setUnitId((profile as any).unit_id);
    }
  }, [profile, unitId]);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => api.departments.list({ active: true }),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      // 1. Upload attachments in parallel, tracking per-file status
      const uploadedUrls: string[] = [];
      let firstImageUrl: string | null = null;
      if (attachments.length > 0) {
        const working = [...attachments];
        working.forEach((it, i) => { working[i] = { ...it, status: "uploading" }; });
        setAttachments([...working]);

        await Promise.all(
          working.map(async (item, idx) => {
            try {
              const { url } = await api.uploadFile(item.file);
              uploadedUrls.push(url);
              if (!firstImageUrl && item.file.type.startsWith("image/")) firstImageUrl = url;
              working[idx] = { ...working[idx], status: "success", url };
            } catch (err: any) {
              working[idx] = { ...working[idx], status: "error", error: err?.message || "Upload failed" };
            }
            setAttachments([...working]);
          })
        );
      }

      // 2. Create the ticket (server assigns the ticket number + SLA)
      await api.tickets.create({
        title,
        description,
        unit_id: unitId || null,
        department_id: profile?.department_id || null,
        issue_department_id: issueDeptId || null,
        priority,
        attachments: uploadedUrls,
        photo_url: firstImageUrl,
      });

      toast({ title: "Ticket Created", description: "Your ticket has been submitted successfully." });
      navigate("/my-tickets");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to create ticket", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="Create Ticket">
      <div className="max-w-3xl mx-auto">
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">New Support Ticket</CardTitle>
            <p className="text-sm text-muted-foreground">Fill in the details below to raise a new ticket.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-lg bg-muted/50 p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Raised By</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-medium">{profile?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Employee ID</p>
                    <p className="text-sm font-medium">{profile?.employee_id || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="text-sm font-medium">{profile?.contact || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select value={unitId} onValueChange={setUnitId}>
                    <SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger>
                    <SelectContent>
                      {units?.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Issue Department *</Label>
                  <Select value={issueDeptId} onValueChange={setIssueDeptId} required>
                    <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                    <SelectContent>
                      {departments?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="critical">🔴 Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ticket Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief summary of the issue" required />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide detailed information..." rows={4} required />
              </div>

              <div className="space-y-2">
                <Label>Attachments (Optional)</Label>
                <AttachmentDropzone
                  items={attachments}
                  onChange={setAttachments}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? "Submitting..." : "Submit Ticket"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
