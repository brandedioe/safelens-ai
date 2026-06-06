"use client";
import { useState, useEffect } from "react";
import { Plus, Check, Trash2, X, ChevronRight } from "lucide-react";
import {
  FamilyProfile,
  getFamilyProfiles,
  saveFamilyProfile,
  deleteFamilyProfile,
  setActiveProfile,
} from "@/lib/storage";

const TYPES: { key: FamilyProfile["type"]; label: string; emoji: string; hint: string }[] = [
  { key: "self",     label: "Self",           emoji: "👤", hint: "Your own profile" },
  { key: "child",    label: "Child",          emoji: "👶", hint: "Under 18 - stricter limits" },
  { key: "elderly",  label: "Elderly Parent", emoji: "👴", hint: "65+ with medications" },
  { key: "pregnant", label: "Pregnant",       emoji: "🤰", hint: "Extra additive caution" },
  { key: "custom",   label: "Other",          emoji: "👥", hint: "Custom profile" },
];

const TYPE_COLOR: Record<string, string> = {
  self: "#10B981", child: "#4F90F0", elderly: "#8B5CF6",
  pregnant: "#F59E0B", custom: "#6B7280",
};

const EMPTY = {
  name: "", type: "self" as FamilyProfile["type"],
  allergies: "", medications: "", conditions: "", aboutMe: "",
};

export default function FamilyProfiles({
  onProfileChange,
}: {
  onProfileChange: (p: FamilyProfile | null) => void;
}) {
  const [profiles, setProfiles]   = useState<FamilyProfile[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [editId,   setEditId]     = useState<string | null>(null);
  const [form,     setForm]       = useState(EMPTY);
  const [deleting, setDeleting]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setProfiles(await getFamilyProfiles());
  }

  function startAdd() {
    setForm(EMPTY);
    setEditId(null);
    setShowForm(true);
  }

  function startEdit(p: FamilyProfile) {
    setForm({
      name:        p.name,
      type:        p.type,
      allergies:   p.allergies.join(", "),
      medications: p.medications.join(", "),
      conditions:  p.conditions.join(", "),
      aboutMe:     p.aboutMe ?? "",
    });
    setEditId(p.id);
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    const split = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
    const existing = profiles.find(p => p.id === editId);
    const profile: FamilyProfile = {
      id:          editId ?? "p-" + Date.now(),
      name:        form.name.trim(),
      type:        form.type,
      allergies:   split(form.allergies),
      medications: split(form.medications),
      conditions:  split(form.conditions),
      aboutMe:     form.aboutMe.trim() || undefined,
      isActive:    existing?.isActive ?? profiles.length === 0,
      createdAt:   existing?.createdAt ?? Date.now(),
    };
    await saveFamilyProfile(profile);
    setShowForm(false);
    setEditId(null);
    await load();
    if (profile.isActive) onProfileChange(profile);
  }

  async function activate(id: string) {
    await setActiveProfile(id);
    const all = await getFamilyProfiles();
    setProfiles(all);
    onProfileChange(all.find(p => p.id === id) ?? null);
  }

  async function remove(id: string) {
    await deleteFamilyProfile(id);
    setDeleting(null);
    await load();
  }

  const typeInfo = (k: string) => TYPES.find(t => t.key === k) ?? TYPES[0];

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-4">
        <div>
          <p className="text-white font-semibold text-sm">Family Profiles</p>
          <p className="text-gray-500 text-xs mt-0.5">Active profile shapes every AI scan result</p>
        </div>
        <button
          onClick={startAdd}
          className="flex items-center gap-1.5 bg-[#10B981] text-white text-xs font-semibold px-3 py-2 rounded-xl"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Empty state */}
      {profiles.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
          <span className="text-5xl">👥</span>
          <p className="text-gray-400 text-sm leading-relaxed">
            Add a profile so SafeLens can personalise allergy alerts, drug interaction checks,
            and AI analysis for each family member.
          </p>
          <button
            onClick={startAdd}
            className="bg-[#10B981] text-white text-sm font-semibold px-6 py-2.5 rounded-xl mt-2"
          >
            Create first profile
          </button>
        </div>
      )}

      {/* Add / edit form */}
      {showForm && (
        <div className="bg-[#1A2235] border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white text-sm font-semibold">
              {editId ? "Edit Profile" : "New Profile"}
            </p>
            <button onClick={() => setShowForm(false)} className="text-gray-500 p-1">
              <X size={16} />
            </button>
          </div>

          {/* Name */}
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Name (e.g. Mama, Tunde, Baby Zara)"
            className="w-full bg-[#0D1220] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#10B981] mb-3"
          />

          {/* Type selector */}
          <p className="text-gray-400 text-xs uppercase tracking-wide font-medium mb-2">Profile type</p>
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => setForm(f => ({ ...f, type: t.key }))}
                className="flex flex-col items-center gap-1 p-2 rounded-xl border transition-all"
                style={{
                  borderColor: form.type === t.key ? TYPE_COLOR[t.key] : "rgba(255,255,255,0.08)",
                  background:  form.type === t.key ? TYPE_COLOR[t.key] + "22" : "transparent",
                }}
                title={t.hint}
              >
                <span className="text-lg leading-none">{t.emoji}</span>
                <span className="text-[9px] text-gray-400 text-center leading-tight">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Allergies */}
          <input
            value={form.allergies}
            onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
            placeholder="Allergies (e.g. Peanuts, Shellfish, Lactose)"
            className="w-full bg-[#0D1220] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-red-400 mb-2"
          />

          {/* Medications */}
          <input
            value={form.medications}
            onChange={e => setForm(f => ({ ...f, medications: e.target.value }))}
            placeholder="Medications (e.g. Metformin, Atorvastatin)"
            className="w-full bg-[#0D1220] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-400 mb-2"
          />

          {/* Conditions */}
          <input
            value={form.conditions}
            onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))}
            placeholder="Conditions (e.g. Diabetes, Hypertension, Kidney disease)"
            className="w-full bg-[#0D1220] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-purple-400 mb-2"
          />

          {/* Health goals / about me — fed directly to the AI */}
          <textarea
            value={form.aboutMe}
            onChange={e => setForm(f => ({ ...f, aboutMe: e.target.value }))}
            placeholder="Health goals (e.g. losing weight, managing blood sugar, building muscle). The AI uses this to personalise every scan result."
            rows={3}
            className="w-full bg-[#0D1220] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#10B981] mb-4 resize-none"
          />

          <button
            onClick={save}
            disabled={!form.name.trim()}
            className="w-full bg-[#10B981] text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
          >
            {editId ? "Save Changes" : "Create Profile"}
          </button>
        </div>
      )}

      {/* Profile list */}
      <div className="flex flex-col gap-3">
        {profiles.map(p => {
          const ti    = typeInfo(p.type);
          const col   = TYPE_COLOR[p.type] ?? "#6B7280";
          const isDel = deleting === p.id;

          return (
            <div
              key={p.id}
              className="bg-[#1A2235] border rounded-2xl p-4 transition-all"
              style={{ borderColor: p.isActive ? col : "rgba(255,255,255,0.07)" }}
            >
              {/* Top row */}
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-base"
                  style={{ background: col + "22", border: "1.5px solid " + col }}
                >
                  {ti.emoji}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-semibold">{p.name}</span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: col + "22", color: col }}
                    >
                      {ti.label}
                    </span>
                    {p.isActive && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#10B981] text-white">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.allergies.map(a => (
                      <span key={a} className="text-[10px] bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded-full">
                        {a}
                      </span>
                    ))}
                    {p.medications.map(m => (
                      <span key={m} className="text-[10px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded-full">
                        {m}
                      </span>
                    ))}
                    {p.conditions.map(c => (
                      <span key={c} className="text-[10px] bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded-full">
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Health goals preview */}
                  {p.aboutMe && (
                    <p className="text-[10px] text-[#10B981]/70 mt-1 truncate">
                      Goals: {p.aboutMe}
                    </p>
                  )}
                </div>
              </div>

              {/* Action row */}
              <div className="flex gap-2 mt-3">
                {!p.isActive && (
                  <button
                    onClick={() => activate(p.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                    style={{ borderColor: col, color: col }}
                  >
                    <Check size={12} /> Set Active
                  </button>
                )}
                <button
                  onClick={() => startEdit(p)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium bg-white/5 text-gray-400 border border-white/5"
                >
                  Edit
                </button>
                {isDel ? (
                  <button
                    onClick={() => remove(p.id)}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-red-500 text-white"
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    onClick={() => setDeleting(p.id)}
                    className="p-2 rounded-xl text-gray-600 bg-white/5 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}