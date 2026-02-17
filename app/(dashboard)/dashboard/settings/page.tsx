/* eslint-disable @typescript-eslint/no-explicit-any */

// app/(dashboard)/dashboard/settings/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
    User,
    Lock,
    Users,
    Save,
    Loader2,
    CheckCircle,
    XCircle,
    AlertCircle,
    Plus,
    Trash2,
    Edit3,
    X,
    Shield,
    ShieldCheck,
    Eye,
    EyeOff,
} from "lucide-react";

// ── Types ────────────────────────────────────────────
interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: string;
}

interface Toast {
    id: number;
    type: "success" | "error" | "info";
    message: string;
}

// ── Tab config ───────────────────────────────────────
const tabs = [
    { id: "profile", label: "Profile", icon: User, adminOnly: false },
    { id: "password", label: "Password", icon: Lock, adminOnly: false },
    { id: "users", label: "User Management", icon: Users, adminOnly: true },
] as const;

type TabId = (typeof tabs)[number]["id"];

// ── Component ────────────────────────────────────────
export default function SettingsPage() {
    const { data: session } = useSession();
    const isAdmin = (session?.user as any)?.role === "ADMIN";

    const [activeTab, setActiveTab] = useState<TabId>("profile");
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useState(0);

    const showToast = useCallback(
        (type: Toast["type"], message: string) => {
            const id = ++toastId[0];
            setToasts((p) => [...p, { id, type, message }]);
            setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
        },
        [toastId]
    );

    return (
        <div className="space-y-6">
            {/* Toast notifications */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] animate-in slide-in-from-right duration-300 ${t.type === "success"
                            ? "bg-green-50 border border-green-200"
                            : t.type === "error"
                                ? "bg-red-50 border border-red-200"
                                : "bg-blue-50 border border-blue-200"
                            }`}
                    >
                        {t.type === "success" && (
                            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                        )}
                        {t.type === "error" && (
                            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                        )}
                        {t.type === "info" && (
                            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                        )}
                        <span
                            className={`text-sm font-medium ${t.type === "success"
                                ? "text-green-800"
                                : t.type === "error"
                                    ? "text-red-800"
                                    : "text-blue-800"
                                }`}
                        >
                            {t.message}
                        </span>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600 mt-2">
                    Manage your account and application preferences
                </p>
            </div>

            {/* Tabs + Content */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Tabs */}
                <div className="lg:w-56 shrink-0">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {tabs
                            .filter((tab) => !tab.adminOnly || isAdmin)
                            .map((tab) => {
                                const Icon = tab.icon;
                                const active = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors border-l-[3px] ${active
                                            ? "bg-indigo-50 text-indigo-700 border-indigo-600"
                                            : "text-gray-600 hover:bg-gray-50 border-transparent"
                                            }`}
                                    >
                                        <Icon className="w-4.5 h-4.5" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {activeTab === "profile" && <ProfileSection showToast={showToast} />}
                    {activeTab === "password" && (
                        <PasswordSection showToast={showToast} />
                    )}
                    {activeTab === "users" && isAdmin && (
                        <UserManagementSection showToast={showToast} />
                    )}
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════
// Profile Section
// ══════════════════════════════════════════════════════
function ProfileSection({
    showToast,
}: {
    showToast: (t: Toast["type"], m: string) => void;
}) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/settings/profile")
            .then((r) => r.json())
            .then((data) => {
                setProfile(data);
                setName(data.name || "");
                setEmail(data.email || "");
            })
            .catch(() => showToast("error", "Failed to load profile"))
            .finally(() => setLoading(false));
    }, [showToast]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/settings/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setProfile(data);
            showToast("success", "Profile updated successfully");
        } catch (err: any) {
            showToast("error", err.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <SectionSkeleton />;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-600" />
                    Profile Information
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Update your personal details
                </p>
            </div>
            <div className="p-6 space-y-5">
                {/* Role badge */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Role:</span>
                    <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${profile?.role === "ADMIN"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                            }`}
                    >
                        {profile?.role === "ADMIN" ? (
                            <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                            <Shield className="w-3.5 h-3.5" />
                        )}
                        {profile?.role}
                    </span>
                </div>

                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Full Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                        placeholder="Enter your name"
                    />
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email Address
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                        placeholder="Enter your email"
                    />
                </div>

                {/* Member since */}
                {profile?.createdAt && (
                    <p className="text-xs text-gray-400">
                        Member since{" "}
                        {new Date(profile.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                )}

                {/* Save */}
                <div className="pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || (!name && !email)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════
// Password Section
// ══════════════════════════════════════════════════════
function PasswordSection({
    showToast,
}: {
    showToast: (t: Toast["type"], m: string) => void;
}) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    const handleSubmit = async () => {
        if (newPassword !== confirmPassword) {
            showToast("error", "New passwords do not match");
            return;
        }
        if (newPassword.length < 6) {
            showToast("error", "Password must be at least 6 characters");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/settings/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast("success", "Password changed successfully");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            showToast("error", err.message || "Failed to change password");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-indigo-600" />
                    Change Password
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Keep your account secure with a strong password
                </p>
            </div>
            <div className="p-6 space-y-5">
                {/* Current */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Current Password
                    </label>
                    <div className="relative">
                        <input
                            type={showCurrent ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-11 transition-shadow"
                            placeholder="Enter current password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showCurrent ? (
                                <EyeOff className="w-4.5 h-4.5" />
                            ) : (
                                <Eye className="w-4.5 h-4.5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* New */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        New Password
                    </label>
                    <div className="relative">
                        <input
                            type={showNew ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-11 transition-shadow"
                            placeholder="Enter new password (min 6 characters)"
                        />
                        <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showNew ? (
                                <EyeOff className="w-4.5 h-4.5" />
                            ) : (
                                <Eye className="w-4.5 h-4.5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Confirm */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Confirm New Password
                    </label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow ${confirmPassword && confirmPassword !== newPassword
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300"
                            }`}
                        placeholder="Confirm new password"
                    />
                    {confirmPassword && confirmPassword !== newPassword && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                </div>

                {/* Password strength indicator */}
                {newPassword && (
                    <div className="space-y-1.5">
                        <p className="text-xs text-gray-500 font-medium">
                            Password strength
                        </p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => {
                                const strength =
                                    newPassword.length >= 12
                                        ? 4
                                        : newPassword.length >= 8
                                            ? 3
                                            : newPassword.length >= 6
                                                ? 2
                                                : 1;
                                const colors = [
                                    "bg-red-400",
                                    "bg-orange-400",
                                    "bg-yellow-400",
                                    "bg-green-500",
                                ];
                                return (
                                    <div
                                        key={level}
                                        className={`h-1.5 flex-1 rounded-full transition-colors ${level <= strength ? colors[strength - 1] : "bg-gray-200"
                                            }`}
                                    />
                                );
                            })}
                        </div>
                        <p className="text-xs text-gray-400">
                            {newPassword.length < 6
                                ? "Too short"
                                : newPassword.length < 8
                                    ? "Fair"
                                    : newPassword.length < 12
                                        ? "Good"
                                        : "Strong"}
                        </p>
                    </div>
                )}

                <div className="pt-2">
                    <button
                        onClick={handleSubmit}
                        disabled={
                            saving || !currentPassword || !newPassword || !confirmPassword
                        }
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Lock className="w-4 h-4" />
                        )}
                        {saving ? "Changing..." : "Change Password"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════
// User Management Section (Admin only)
// ══════════════════════════════════════════════════════
function UserManagementSection({
    showToast,
}: {
    showToast: (t: Toast["type"], m: string) => void;
}) {
    const { data: session } = useSession();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editUser, setEditUser] = useState<UserProfile | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch("/api/settings/users");
            const data = await res.json();
            if (res.ok) setUsers(data);
        } catch {
            showToast("error", "Failed to load users");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/settings/users/${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast("success", "User deleted successfully");
            setDeleteConfirm(null);
            fetchUsers();
        } catch (err: any) {
            showToast("error", err.message || "Failed to delete user");
        }
    };

    if (loading) return <SectionSkeleton />;

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            User Management
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {users.length} registered user{users.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add User
                    </button>
                </div>

                <div className="divide-y divide-gray-100">
                    {users.map((user) => {
                        const isSelf = user.id === (session?.user as any)?.id;
                        return (
                            <div
                                key={user.id}
                                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${user.role === "ADMIN"
                                            ? "bg-purple-100 text-purple-700"
                                            : "bg-indigo-100 text-indigo-700"
                                            }`}
                                    >
                                        {(user.name || user.email).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {user.name || "Unnamed"}
                                            </p>
                                            {isSelf && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-medium">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${user.role === "ADMIN"
                                            ? "bg-purple-100 text-purple-700"
                                            : "bg-gray-100 text-gray-600"
                                            }`}
                                    >
                                        {user.role === "ADMIN" ? (
                                            <ShieldCheck className="w-3 h-3" />
                                        ) : (
                                            <Shield className="w-3 h-3" />
                                        )}
                                        {user.role}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setEditUser(user)}
                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Edit user"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        {!isSelf && (
                                            <>
                                                {deleteConfirm === user.id ? (
                                                    <div className="flex items-center gap-1 ml-1">
                                                        <button
                                                            onClick={() => handleDelete(user.id)}
                                                            className="px-2 py-1 text-xs bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirm(user.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete user"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <UserFormModal
                    title="Add New User"
                    showToast={showToast}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        setShowAddModal(false);
                        fetchUsers();
                    }}
                />
            )}

            {/* Edit User Modal */}
            {editUser && (
                <UserFormModal
                    title="Edit User"
                    user={editUser}
                    showToast={showToast}
                    onClose={() => setEditUser(null)}
                    onSuccess={() => {
                        setEditUser(null);
                        fetchUsers();
                    }}
                />
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════
// User Form Modal (Add / Edit)
// ══════════════════════════════════════════════════════
function UserFormModal({
    title,
    user,
    showToast,
    onClose,
    onSuccess,
}: {
    title: string;
    user?: UserProfile;
    showToast: (t: Toast["type"], m: string) => void;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [name, setName] = useState(user?.name || "");
    const [email, setEmail] = useState(user?.email || "");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState(user?.role || "USER");
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const isEdit = !!user;

    const handleSubmit = async () => {
        if (!name || !email || (!isEdit && !password)) {
            showToast("error", "Please fill all required fields");
            return;
        }
        setSaving(true);
        try {
            const url = isEdit ? `/api/settings/users/${user.id}` : "/api/settings/users";
            const method = isEdit ? "PUT" : "POST";
            const body: any = { name, email, role };
            if (password) body.password = password;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast("success", isEdit ? "User updated" : "User created");
            onSuccess();
        } catch (err: any) {
            showToast("error", err.message || "Operation failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Enter name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Enter email"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password{" "}
                            {!isEdit && <span className="text-red-500">*</span>}
                            {isEdit && (
                                <span className="text-gray-400 font-normal">
                                    (leave empty to keep current)
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-11"
                                placeholder={isEdit ? "••••••" : "Min 6 characters"}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                ) : (
                                    <Eye className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role
                        </label>
                        <div className="flex gap-3">
                            {(["USER", "ADMIN"] as const).map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRole(r)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${role === r
                                        ? r === "ADMIN"
                                            ? "border-purple-500 bg-purple-50 text-purple-700"
                                            : "border-indigo-500 bg-indigo-50 text-indigo-700"
                                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                                        }`}
                                >
                                    {r === "ADMIN" ? (
                                        <ShieldCheck className="w-4 h-4" />
                                    ) : (
                                        <Shield className="w-4 h-4" />
                                    )}
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {saving ? "Saving..." : isEdit ? "Update" : "Create"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════
// Skeleton loader
// ══════════════════════════════════════════════════════
function SectionSkeleton() {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-48" />
                <div className="h-4 bg-gray-100 rounded w-64" />
                <div className="space-y-3 pt-4">
                    <div className="h-10 bg-gray-100 rounded" />
                    <div className="h-10 bg-gray-100 rounded" />
                    <div className="h-10 bg-gray-100 rounded w-32" />
                </div>
            </div>
        </div>
    );
}
