import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, PlusCircle, Save, X, Shield } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Permissions } from "@/contexts/PermissionsContext";

type AppRole = "super_admin" | "admin" | "hod" | "user" | "assigned_person";

interface RoleRow {
  id: string;
  name: AppRole;
  description: string | null;
  permissions: Permissions;
  created_at: string;
  updated_at: string;
}

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "hod", label: "HOD" },
  { value: "assigned_person", label: "Team Member" },
  { value: "user", label: "User" },
];

const DEFAULT_PERMS: Permissions = {
  tickets: { create: false, viewAll: false, viewOwn: true, assign: false, updateStatus: false, close: false, delete: false },
  dashboard: { view: false, scope: "own" },
  sidebar: {
    overview: true, analytics: false, summary: false, createTicket: false, myTickets: true,
    pendingTickets: false, assignedTickets: false, departmentTickets: false, pcReview: false, manageUsers: false, settings: false,
  },
  department: "own",
};

const SIDEBAR_LABELS: { key: keyof Permissions["sidebar"]; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "analytics", label: "Analytics" },
  { key: "summary", label: "Summary" },
  { key: "createTicket", label: "Create Ticket" },
  { key: "myTickets", label: "My Tickets" },
  { key: "pendingTickets", label: "Pending Tickets" },
  { key: "assignedTickets", label: "Assigned Tickets" },
  { key: "departmentTickets", label: "Department Tickets" },
  { key: "pcReview", label: "PC Review" },
  { key: "manageUsers", label: "Manage Users" },
  { key: "settings", label: "Settings" },
];

const TICKET_LABELS: { key: keyof Permissions["tickets"]; label: string; note?: string }[] = [
  { key: "create", label: "Create Ticket" },
  { key: "viewAll", label: "View All Tickets" },
  { key: "viewOwn", label: "View Own Tickets" },
  { key: "assign", label: "Assign Tickets" },
  { key: "updateStatus", label: "Update Ticket Status" },
  { key: "close", label: "Close Tickets" },
  { key: "delete", label: "Delete Tickets", note: "Superadmin only" },
];

interface FormState {
  name: AppRole;
  description: string;
  permissions: Permissions;
}

export function RolesPermissionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleRow | null>(null);
  const [form, setForm] = useState<FormState>({ name: "user", description: "", permissions: DEFAULT_PERMS });

  const { data: roles, isLoading } = useQuery<RoleRow[]>({
    queryKey: ["roles-permissions"],
    queryFn: async () => (await api.roles.list()) as RoleRow[],
    refetchOnWindowFocus: false,
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: FormState & { id?: string }) => {
      const body = {
        name: payload.name,
        description: payload.description || null,
        permissions: payload.permissions,
      };
      if (payload.id) {
        return (await api.roles.update(payload.id, body)) as RoleRow;
      }
      return (await api.roles.create(body)) as RoleRow;
    },
    onSuccess: (saved, vars) => {
      queryClient.setQueryData<RoleRow[]>(["roles-permissions"], (old) => {
        if (!old) return [saved];
        return vars.id ? old.map((r) => (r.id === saved.id ? saved : r)) : [...old, saved];
      });
      toast({ title: vars.id ? "Role updated successfully" : "Role created successfully" });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.roles.remove(id);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["roles-permissions"] });
      const prev = queryClient.getQueryData<RoleRow[]>(["roles-permissions"]);
      queryClient.setQueryData<RoleRow[]>(["roles-permissions"], (old) => old?.filter((r) => r.id !== id) ?? []);
      return { prev };
    },
    onSuccess: () => { toast({ title: "Role deleted" }); setDeletingRole(null); },
    onError: (e: Error, _id, ctx) => {
      queryClient.setQueryData(["roles-permissions"], ctx?.prev);
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "user", description: "", permissions: DEFAULT_PERMS });
    setFormOpen(true);
  };

  const openEdit = (r: RoleRow) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description ?? "", permissions: r.permissions });
    setFormOpen(true);
  };

  const handleSave = () => {
    upsertMutation.mutate({ ...form, id: editing?.id });
  };

  const updateTicket = (key: keyof Permissions["tickets"], value: boolean) =>
    setForm((f) => ({ ...f, permissions: { ...f.permissions, tickets: { ...f.permissions.tickets, [key]: value } } }));

  const updateSidebar = (key: keyof Permissions["sidebar"], value: boolean) =>
    setForm((f) => ({ ...f, permissions: { ...f.permissions, sidebar: { ...f.permissions.sidebar, [key]: value } } }));

  const summaryChip = (label: string, on: boolean) => (
    <Badge variant="outline" className={on ? "border-success text-success bg-success/10" : "border-muted-foreground/30 text-muted-foreground bg-muted/30"}>
      {label} {on ? "✓" : "✗"}
    </Badge>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Roles & Permissions</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Define what each role can see and do across the app.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusCircle className="h-4 w-4 mr-2" /> Create New Role
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Permissions Summary</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {[1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}><div className="h-8 bg-muted animate-pulse rounded" /></TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {!isLoading && roles?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No roles found. Create your first role.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && roles?.map((r) => {
              const isSuper = r.name === "super_admin";
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {ROLE_OPTIONS.find((o) => o.value === r.name)?.label ?? r.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.description ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {summaryChip("Create", r.permissions?.tickets?.create)}
                      {summaryChip("Assign", r.permissions?.tickets?.assign)}
                      {summaryChip("View All", r.permissions?.tickets?.viewAll)}
                      {summaryChip("Delete", r.permissions?.tickets?.delete)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive disabled:opacity-30"
                      onClick={() => setDeletingRole(r)}
                      disabled={isSuper}
                      title={isSuper ? "Super Admin role cannot be deleted" : "Delete role"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {formOpen && (
          <Card className="border-primary/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{editing ? "Edit Role" : "Create New Role"}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => { setFormOpen(false); setEditing(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role Name *</Label>
                  <Input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value as AppRole })}
                    disabled={!!editing}
                    placeholder="Enter role name"
                  />
                  {editing && <p className="text-xs text-muted-foreground">Role name cannot be changed after creation.</p>}
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What this role is for"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* A. Ticket Permissions */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider border-b pb-2">A. Ticket Permissions</h4>
                  {TICKET_LABELS.map((t) => (
                    <div key={t.key} className="flex items-center justify-between">
                      <Label className="font-normal text-sm">
                        {t.label}
                        {t.note && <span className="ml-2 text-xs text-muted-foreground">({t.note})</span>}
                      </Label>
                      <Switch
                        checked={form.permissions.tickets[t.key]}
                        onCheckedChange={(v) => updateTicket(t.key, v)}
                      />
                    </div>
                  ))}
                </div>

                {/* B. Dashboard */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider border-b pb-2">B. Dashboard Access</h4>
                  <div className="flex items-center justify-between">
                    <Label className="font-normal text-sm">View Dashboard</Label>
                    <Switch
                      checked={form.permissions.dashboard.view}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, permissions: { ...f.permissions, dashboard: { ...f.permissions.dashboard, view: v } } }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data Scope</Label>
                    <RadioGroup
                      value={form.permissions.dashboard.scope}
                      onValueChange={(v) => setForm((f) => ({ ...f, permissions: { ...f.permissions, dashboard: { ...f.permissions.dashboard, scope: v as any } } }))}
                    >
                      <div className="flex items-center gap-2"><RadioGroupItem value="all" id="ds-all" /><Label htmlFor="ds-all" className="font-normal">All Departments</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="department" id="ds-dept" /><Label htmlFor="ds-dept" className="font-normal">Own Department only</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="own" id="ds-own" /><Label htmlFor="ds-own" className="font-normal">Own data only</Label></div>
                    </RadioGroup>
                  </div>
                </div>

                {/* C. Sidebar */}
                <div className="border rounded-lg p-4 space-y-3 md:col-span-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider border-b pb-2">C. Sidebar Module Access</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {SIDEBAR_LABELS.map((s) => (
                      <div key={s.key} className="flex items-center gap-2">
                        <Checkbox
                          id={`sb-${s.key}`}
                          checked={form.permissions.sidebar[s.key]}
                          onCheckedChange={(v) => updateSidebar(s.key, !!v)}
                        />
                        <Label htmlFor={`sb-${s.key}`} className="font-normal text-sm cursor-pointer">{s.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* D. Department restriction */}
                <div className="border rounded-lg p-4 space-y-3 md:col-span-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider border-b pb-2">D. Department Data Restriction</h4>
                  <RadioGroup
                    value={form.permissions.department}
                    onValueChange={(v) => setForm((f) => ({ ...f, permissions: { ...f.permissions, department: v as any } }))}
                  >
                    <div className="flex items-center gap-2"><RadioGroupItem value="all" id="dep-all" /><Label htmlFor="dep-all" className="font-normal">Access all departments</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="own" id="dep-own" /><Label htmlFor="dep-own" className="font-normal">Access own department data only</Label></div>
                  </RadioGroup>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancel</Button>
                <Button onClick={handleSave} disabled={upsertMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> {editing ? "Update Role" : "Save Role"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>

      <AlertDialog open={!!deletingRole} onOpenChange={(o) => !o && setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>
              Users assigned to <strong>{deletingRole?.name}</strong> will lose their permissions until reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingRole && deleteMutation.mutate(deletingRole.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
