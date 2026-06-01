import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "./env.js";
import { connectDB } from "./db.js";
import { Role } from "./models/Role.js";
import { User } from "./models/User.js";
import { Profile } from "./models/Profile.js";
import { UserRole } from "./models/UserRole.js";
import { NotificationPref } from "./models/NotificationPref.js";

// Mirrors the Permissions shape consumed by the frontend PermissionsContext.
const ROLE_SEED = [
  {
    name: "super_admin",
    description: "Full access to everything",
    permissions: {
      tickets: { create: true, viewAll: true, viewOwn: true, assign: true, updateStatus: true, close: true, delete: true },
      dashboard: { view: true, scope: "all" },
      sidebar: { overview: true, analytics: true, summary: true, createTicket: true, myTickets: true, pendingTickets: true, assignedTickets: true, departmentTickets: true, pcReview: true, manageUsers: true, settings: true },
      department: "all",
    },
  },
  {
    name: "admin",
    description: "Administrative access",
    permissions: {
      tickets: { create: true, viewAll: true, viewOwn: true, assign: true, updateStatus: true, close: true, delete: false },
      dashboard: { view: true, scope: "all" },
      sidebar: { overview: true, analytics: true, summary: true, createTicket: true, myTickets: true, pendingTickets: true, assignedTickets: true, departmentTickets: true, pcReview: true, manageUsers: true, settings: false },
      department: "all",
    },
  },
  {
    name: "hod",
    description: "Head of Department",
    permissions: {
      tickets: { create: true, viewAll: false, viewOwn: true, assign: true, updateStatus: true, close: false, delete: false },
      dashboard: { view: true, scope: "department" },
      sidebar: { overview: true, analytics: true, summary: true, createTicket: true, myTickets: true, pendingTickets: true, assignedTickets: true, departmentTickets: true, pcReview: true, manageUsers: false, settings: false },
      department: "own",
    },
  },
  {
    name: "assigned_person",
    description: "Technician / assignee",
    permissions: {
      tickets: { create: false, viewAll: false, viewOwn: true, assign: false, updateStatus: true, close: true, delete: false },
      dashboard: { view: false, scope: "own" },
      sidebar: { overview: true, analytics: false, summary: false, createTicket: false, myTickets: true, pendingTickets: false, assignedTickets: true, departmentTickets: false, pcReview: false, manageUsers: false, settings: false },
      department: "own",
    },
  },
  {
    name: "user",
    description: "Standard user",
    permissions: {
      tickets: { create: true, viewAll: false, viewOwn: true, assign: false, updateStatus: false, close: false, delete: false },
      dashboard: { view: false, scope: "own" },
      sidebar: { overview: true, analytics: false, summary: false, createTicket: true, myTickets: true, pendingTickets: false, assignedTickets: false, departmentTickets: false, pcReview: false, manageUsers: false, settings: false },
      department: "own",
    },
  },
];

async function seed() {
  await connectDB();

  for (const r of ROLE_SEED) {
    await Role.updateOne({ name: r.name }, { $set: r }, { upsert: true });
  }
  console.log(`[seed] ${ROLE_SEED.length} roles upserted`);

  const email = env.SUPER_ADMIN_EMAIL.toLowerCase().trim();
  let admin = await User.findOne({ email });
  if (!admin) {
    admin = await User.create({ email, password_hash: await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 10) });
    await Profile.create({ user_id: admin._id, name: env.SUPER_ADMIN_NAME, username: email.split("@")[0] });
    await UserRole.create({ user_id: admin._id, role: "super_admin" });
    await NotificationPref.create({ user_id: admin._id });
    console.log(`[seed] super-admin created: ${email} / ${env.SUPER_ADMIN_PASSWORD}`);
  } else {
    console.log(`[seed] super-admin already exists: ${email}`);
  }

  await mongoose.disconnect();
  console.log("[seed] done");
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
