import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader } from "@/components/loader";
import { AVATAR_ICONS, getAvatar, type AvatarKey } from "@/lib/avatar-icons";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "Profile — SkillBoard" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    enabled: !!uid,
    queryKey: ["profile", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [icon, setIcon] = useState<AvatarKey>("spark");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFullName(data.full_name ?? "");
    setPhone(data.phone ?? "");
    setBio(data.bio ?? "");
    setStudentId(data.student_id ?? "");
    setDepartment(data.department ?? "");
    setIcon((data.avatar_icon as AvatarKey) ?? "spark");
  }, [data]);

  async function save() {
    if (!uid) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone,
          bio,
          student_id: studentId,
          department,
          avatar_icon: icon,
        })
        .eq("id", uid);
      if (error) throw error;
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile", uid] });
      qc.invalidateQueries({ queryKey: ["student-home", uid] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <Loader />;

  const current = getAvatar(icon);

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Pick an activity avatar and manage your personal details. Private info stays private to you.
        </p>
      </header>

      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-4">
          <img
            src={current.src}
            alt={current.label}
            width={80}
            height={80}
            className="h-20 w-20 rounded-2xl bg-white object-contain ring-1 ring-border"
          />
          <div>
            <div className="font-semibold">{current.label} avatar</div>
            <div className="text-xs text-muted-foreground">Choose a theme below.</div>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {(Object.keys(AVATAR_ICONS) as AvatarKey[]).map((k) => {
            const a = AVATAR_ICONS[k];
            const active = icon === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setIcon(k)}
                className={`group flex flex-col items-center gap-1 rounded-xl p-2 transition ${
                  active
                    ? "bg-primary/15 ring-2 ring-primary"
                    : "ring-1 ring-border hover:bg-accent"
                }`}
                aria-pressed={active}
              >
                <img
                  src={a.src}
                  alt={a.label}
                  width={48}
                  height={48}
                  loading="lazy"
                  className="h-12 w-12 rounded-lg bg-white object-contain"
                />
                <span className="text-[10px] text-muted-foreground">{a.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Personal details
          <span className="text-[10px] font-normal text-muted-foreground ml-auto">
            Visible to you and admins only
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name" value={fullName} onChange={setFullName} />
          <Field label="Email" value={data?.email ?? ""} onChange={() => {}} disabled />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="+1 555 0123" />
          <Field label="Student ID" value={studentId} onChange={setStudentId} />
          <Field
            label="Department / Program"
            value={department}
            onChange={setDepartment}
            placeholder="e.g. Computer Science"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="mt-1 w-full glass rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="A short bio shown on your profile…"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-medium glow hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full glass rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
      />
    </div>
  );
}
