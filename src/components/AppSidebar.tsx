import {
  LayoutDashboard,
  LineChart,
  PlusCircle,
  Ticket,
  Clock,
  ClipboardList,
  Building2,
  BarChart3,
  ShieldCheck,
  Settings,
  Users,
  LogOut,
  UserCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, Permissions } from "@/contexts/PermissionsContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/aum-dacro-logo.png";

type AppRole = "super_admin" | "admin" | "hod" | "user" | "assigned_person";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles?: AppRole[];
  permissionKey?: keyof Permissions["sidebar"];
}

const allNav: NavItem[] = [
  { title: "Overview", url: "/", icon: LayoutDashboard, permissionKey: "overview" },
  { title: "My Profile", url: "/profile", icon: UserCircle },
  { title: "Analytics", url: "/analytics", icon: LineChart, permissionKey: "analytics" },
  { title: "Summary", url: "/reports", icon: BarChart3, permissionKey: "summary" },
  { title: "Create Ticket", url: "/create-ticket", icon: PlusCircle, permissionKey: "createTicket" },
  { title: "My Tickets", url: "/my-tickets", icon: Ticket, permissionKey: "myTickets" },
  { title: "Pending Tickets", url: "/pending-tickets", icon: Clock, permissionKey: "pendingTickets" },
  { title: "Assigned Tickets", url: "/assigned-tickets", icon: ClipboardList, permissionKey: "assignedTickets" },
  { title: "Department Tickets", url: "/department-tickets", icon: Building2, permissionKey: "departmentTickets" },
  { title: "PC Review", url: "/pc-review", icon: ShieldCheck, permissionKey: "pcReview" },
];

const adminNav: NavItem[] = [
  { title: "Manage Users", url: "/manage-users", icon: Users, permissionKey: "manageUsers" },
  { title: "Settings", url: "/settings", icon: Settings, permissionKey: "settings" },
];

const roleBadge: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hod: "HOD",
  user: "User",
  assigned_person: "Team Member",
};

function hasAccess(item: NavItem, userRole: AppRole | null, permissions: Permissions, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  // Hard role gate first (preserves existing behavior)
  if (item.roles && (!userRole || !item.roles.includes(userRole))) return false;
  // Then dynamic permission gate (from roles table)
  if (item.permissionKey && !permissions?.sidebar?.[item.permissionKey]) return false;
  return true;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { permissions, isSuperAdmin } = usePermissions();
  const isActive = (path: string) => location.pathname === path;
  const initials = profile?.name?.split(" ").map(n => n[0]).join("") || "?";

  const visibleMain = allNav.filter(item => hasAccess(item, role, permissions, isSuperAdmin));
  const visibleAdmin = adminNav.filter(item => hasAccess(item, role, permissions, isSuperAdmin));

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <img src={logo} alt="Aum Dacro Coatings" className="h-10 w-10 rounded-lg object-contain bg-white p-0.5" />
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground tracking-tight leading-tight">Aum Dacro</h2>
              <p className="text-[10px] text-sidebar-muted-foreground tracking-wide uppercase">Support Portal</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src={logo} alt="ADC" className="h-8 w-8 rounded-lg object-contain bg-white p-0.5" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-primary text-[10px] uppercase tracking-[0.15em] font-semibold">
            {!collapsed && "Main"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent transition-all duration-200 group relative"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium border-l-2 border-l-sidebar-primary"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-primary text-[10px] uppercase tracking-[0.15em] font-semibold">
              {!collapsed && "Administration"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdmin.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent transition-all duration-200 group relative"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium border-l-2 border-l-sidebar-primary"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <Link
            to="/profile"
            title="Edit Profile"
            className="flex items-center gap-3 flex-1 min-w-0 rounded-md p-1.5 -m-1.5 hover:bg-sidebar-accent transition-colors cursor-pointer"
          >
            <Avatar className="h-9 w-9 shrink-0 ring-2 ring-sidebar-primary/30">
              {(profile as any)?.profile_picture && <AvatarImage src={(profile as any).profile_picture} alt={profile?.name || ""} />}
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate flex items-center gap-1.5">
                  {profile?.name || "Loading..."}
                  <UserCircle className="h-3 w-3 text-sidebar-muted-foreground" />
                </p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sidebar-primary/40 text-sidebar-primary font-medium">
                  {role ? roleBadge[role] : ""}
                </Badge>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button onClick={handleLogout} title="Log out" className="text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors p-1.5 rounded-md hover:bg-sidebar-accent shrink-0">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
