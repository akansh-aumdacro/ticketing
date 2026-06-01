import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Shield, PlusCircle, Pencil, Trash2, Eye, EyeOff, Loader2, FileUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { BulkImportUsersDialog } from "@/components/BulkImportUsersDialog";

type AppRole = "super_admin" | "admin" | "hod" | "user" | "assigned_person";

const baseRoleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hod: "HOD",
  user: "User",
  assigned_person: "Team Member",
};

const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  super_admin: "destructive",
  admin: "default",
  hod: "secondary",
  user: "outline",
  assigned_person: "secondary",
};

const formatRoleLabel = (key: string) =>
  baseRoleLabels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface UserForm {
  name: string;
  email: string;
  username: string;
  password: string;
  employeeId: string;
  contact: string;
  role: AppRole;
  departmentId: string;
  unitId: string;
}

const emptyForm: UserForm = {
  name: "", email: "", username: "", password: "", employeeId: "", contact: "", role: "user", departmentId: "none", unitId: "",
};

export default function ManageUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Combined user list (profile + email + role) from the admin endpoint.
  const { data: profiles, isLoading } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => api.users.list(),
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
  const rolesLoading = false;

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => api.departments.list(),
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => api.units.list(),
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const { data: rolesList } = useQuery({
    queryKey: ["roles-list"],
    queryFn: async () => {
      const roles = await api.roles.list();
      return (roles as Array<{ name: string }>).map((r) => r.name);
    },
    refetchOnWindowFocus: false,
  });

  const roleOptions = (() => {
    const set = new Set<string>(Object.keys(baseRoleLabels));
    (rolesList ?? []).forEach((n) => n && set.add(n));
    return Array.from(set);
  })();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
  };

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      await api.users.updateRole(userId, newRole);
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Role Updated" }); },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const updateDepartment = useMutation({
    mutationFn: async ({ userId, departmentId }: { userId: string; departmentId: string | null }) => {
      await api.users.updateProfile(userId, { department_id: departmentId });
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Department Updated" }); },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const getRoleForUser = (userId: string): AppRole => {
    const found = profiles?.find((p) => p.user_id === userId);
    return (found?.role as AppRole) || "user";
  };

  const filtered = profiles?.filter((p) => {
    // Deactivated (soft-deleted) users keep their profile for audit history; hide them here.
    if (p.is_active === false) return false;

    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.username?.toLowerCase().includes(term) ||
      p.employee_id?.toLowerCase().includes(term)
    );
  });

  const handleAddUser = async () => {
    if (!form.name || !form.email || !form.password) {
      toast({ title: "Error", description: "Name, email, and password are required.", variant: "destructive" });
      return;
    }
    if (!form.unitId) {
      toast({ title: "Error", description: "Please select a unit", variant: "destructive" });
      return;
    }
    setFormLoading(true);
    try {
      await api.users.create({
        email: form.email,
        password: form.password,
        name: form.name,
        username: form.username,
        employeeId: form.employeeId,
        contact: form.contact,
        role: form.role,
        departmentId: form.departmentId,
        unitId: form.unitId,
      });
      toast({ title: "User Created", description: `${form.name} has been added successfully.` });
      setAddOpen(false);
      setForm(emptyForm);
      invalidateAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setFormLoading(false);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    if (!form.name.trim()) {
      toast({ title: "Error", description: "Name is required.", variant: "destructive" });
      return;
    }
    setFormLoading(true);
    try {
      // Update profile fields
      const updatedProfile = await api.users.updateProfile(selectedUser.user_id, {
        name: form.name,
        username: form.username || null,
        employee_id: form.employeeId || null,
        contact: form.contact || null,
        department_id: form.departmentId === "none" ? null : form.departmentId,
        unit_id: form.unitId || null,
      });

      // Update role if changed
      const currentRole = getRoleForUser(selectedUser.user_id);
      if (form.role !== currentRole) {
        await api.users.updateRole(selectedUser.user_id, form.role);
      }

      // Update cache directly with confirmed values — no refetch (would race & revert).
      queryClient.setQueryData(["all-profiles"], (old: any[] | undefined) =>
        old?.map((p) =>
          p.user_id === selectedUser.user_id ? { ...p, ...updatedProfile, role: form.role } : p
        )
      );

      // Update email/password if provided
      if ((form.email && form.email.trim()) || (form.password && form.password.length > 0)) {
        await api.users.updateCredentials(selectedUser.user_id, {
          email: form.email?.trim() || undefined,
          password: form.password || undefined,
        });
      }

      toast({ title: "User updated", description: `${form.name}'s details have been saved.` });
      setEditOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setFormLoading(true);

    // Snapshot for rollback if the server rejects
    const prevProfiles = queryClient.getQueryData<any[]>(["all-profiles"]);

    // Optimistically remove from cache immediately
    queryClient.setQueryData(["all-profiles"], (old: any[] | undefined) =>
      old?.filter((p) => p.user_id !== selectedUser.user_id)
    );

    try {
      const result: any = await api.users.remove(selectedUser.user_id);

      // DO NOT invalidate here — soft-deleted users still exist in `profiles` and would
      // reappear in the list. The optimistic removal above is the source of truth.
      toast({
        title: result.mode === "deactivated" ? "User deactivated" : "User deleted",
        description: result.mode === "deactivated"
          ? `${selectedUser.name}'s access has been revoked. Audit history is preserved.`
          : `${selectedUser.name} has been removed.`,
      });
      setDeleteOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      // Roll back optimistic removal so the row reappears
      queryClient.setQueryData(["all-profiles"], prevProfiles);
      toast({ title: "Delete failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = (p: any) => {
    setSelectedUser(p);
    setForm({
      name: p.name,
      email: "",
      username: p.username || "",
      password: "",
      employeeId: p.employee_id || "",
      contact: p.contact || "",
      role: getRoleForUser(p.user_id),
      departmentId: p.department_id || "none",
      unitId: p.unit_id || "",
    });
    setEditOpen(true);
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const getDeptName = (deptId: string | null) => {
    if (!deptId) return "—";
    return departments?.find(d => d.id === deptId)?.name || "—";
  };

  const getUnitName = (unitId: string | null) => {
    if (!unitId) return "—";
    return units?.find(u => u.id === unitId)?.name || "—";
  };

  return (
    <AppLayout title="Manage Users">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">User Management</h2>
            <p className="text-sm text-muted-foreground">Manage roles and department assignments.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <FileUp className="h-4 w-4 mr-2" /> Bulk Import
            </Button>
            <Button onClick={() => { setForm(emptyForm); setAddOpen(true); }}>
              <PlusCircle className="h-4 w-4 mr-2" /> Add User
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> All Users ({filtered?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || rolesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered?.map((p) => {
                      const currentRole = getRoleForUser(p.user_id);
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{getInitials(p.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.username || "—"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{p.employee_id || "—"}</TableCell>
                          <TableCell className="text-sm">{p.contact || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={roleBadgeVariant[currentRole] ?? "outline"}>{formatRoleLabel(currentRole)}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{getDeptName(p.department_id)}</TableCell>
                          <TableCell className="text-sm">{getUnitName(p.unit_id)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setSelectedUser(p); setDeleteOpen(true); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="john.doe" />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} placeholder="EMP-001" />
              </div>
              <div className="space-y-2">
                <Label>Contact</Label>
                <Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="+91..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((key) => (
                      <SelectItem key={key} value={key}>{formatRoleLabel(key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments?.filter((d: any) => d.is_active !== false).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
                <SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger>
                <SelectContent>
                  {units?.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={formLoading}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={formLoading}>
              {formLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>) : "Save User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details for {selectedUser?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Leave blank to keep current" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current" className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((key) => (
                      <SelectItem key={key} value={key}>{formatRoleLabel(key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments?.filter((d: any) => d.is_active !== false).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
                <SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger>
                <SelectContent>
                  {units?.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={formLoading}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={formLoading}>
              {formLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>) : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={formLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={formLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {formLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</>) : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BulkImportUsersDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        departments={(departments || []).filter((d: any) => d.is_active !== false)}
        units={units || []}
        onComplete={invalidateAll}
      />
    </AppLayout>
  );
}
