import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted as isTauriNotificationPermissionGranted,
  requestPermission as requestTauriNotificationPermission,
  sendNotification as sendTauriNotification,
} from "@tauri-apps/plugin-notification";
import "./App.css";

const showDevNotificationTest = Boolean(import.meta.env.DEV);

async function requestNotificationPermission() {
  // Prefer Tauri notifications for packaged desktop/mobile apps.
  try {
    let granted = await isTauriNotificationPermissionGranted();
    if (!granted) {
      const permission = await requestTauriNotificationPermission();
      granted = permission === "granted";
    }
    if (granted) return true;
  } catch {
    // Fall through to Web Notification API.
  }

  if (typeof Notification !== "undefined") {
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "default") {
      try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      } catch {
        return false;
      }
    }
  }

  return false;
}

async function sendBmiReminderNotification(title, body) {
  try {
    await sendTauriNotification({ title, body });
    return true;
  } catch {
    // Fall back when plugin call is unavailable.
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
      return true;
    } catch {
      // Ignore local notification failures.
    }
  }

  return false;
}

function getInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function ProfileAvatar({ profile, className = "w-12 h-12" }) {
  if (profile?.avatar) {
    return <img src={profile.avatar} alt={profile.name} className={`${className} rounded-full object-cover border border-slate-600`} />;
  }

  return (
    <div className={`${className} rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold border border-indigo-300/40 flex items-center justify-center`}>
      {getInitials(profile?.name)}
    </div>
  );
}

function ProfilePicker({ profiles, onSelectProfile, onCreateProfile }) {
  const [draftName, setDraftName] = useState("");
  const [draftAvatar, setDraftAvatar] = useState("");
  const [error, setError] = useState("");

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDraftAvatar(typeof reader.result === "string" ? reader.result : "");
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function createProfile() {
    const cleanName = draftName.trim();
    if (!cleanName) {
      setError("Please enter a profile name.");
      return;
    }

    const profile = {
      id: `profile_${Date.now()}`,
      name: cleanName,
      avatar: draftAvatar,
    };

    onCreateProfile(profile);
    setDraftName("");
    setDraftAvatar("");
    setError("");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 mb-2">Welcome</h1>
        <p className="text-slate-400 text-sm mb-5">Choose a profile or create a new one to start tracking.</p>

        {profiles.length > 0 && (
          <div className="mb-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Your Profiles</h2>
            <div className="grid grid-cols-1 gap-2">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onSelectProfile(profile.id)}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700/50 hover:border-indigo-500/50 px-3 py-2.5 transition-all text-left"
                >
                  <ProfileAvatar profile={profile} className="w-10 h-10" />
                  <span className="text-slate-200 font-medium">{profile.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-700/60 pt-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Create Profile</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Profile name"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />

            <label className="block text-xs text-slate-400">Profile photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-200 hover:file:bg-slate-600"
            />

            {draftName && (
              <div className="flex items-center gap-3 bg-slate-900/40 rounded-xl px-3 py-2 border border-slate-700/50">
                <ProfileAvatar profile={{ name: draftName, avatar: draftAvatar }} className="w-11 h-11" />
                <div>
                  <p className="text-slate-200 text-sm font-medium">{draftName}</p>
                  <p className="text-slate-500 text-xs">Preview</p>
                </div>
              </div>
            )}

            {error && <p className="text-rose-400 text-xs">{error}</p>}

            <button
              type="button"
              onClick={createProfile}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl px-4 py-3 font-semibold transition-all shadow-lg shadow-indigo-500/20"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── BMI Gauge Component ── */
function BmiGauge({ bmi, category }) {
  const canvasRef = useRef(null);
  const [animatedBmi, setAnimatedBmi] = useState(0);

  // Color palette for categories - softer, more modern
  const categoryColors = {
    Underweight: { primary: "#60A5FA", light: "#93C5FD", dark: "#3B82F6" }, // Soft blue
    Normal: { primary: "#4ADE80", light: "#86EFAC", dark: "#22C55E" },      // Soft green
    Overweight: { primary: "#FBBF24", light: "#FCD34D", dark: "#F59E0B" },  // Warm amber
    Obese: { primary: "#F87171", light: "#FCA5A5", dark: "#EF4444" }        // Soft red
  };

  useEffect(() => {
    let start = 0;
    const end = bmi;
    const duration = 1200;
    const startTime = performance.now();

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setAnimatedBmi(current);
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [bmi]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h - 20;
    const radius = Math.min(cx, cy) - 20;

    ctx.clearRect(0, 0, w, h);

    // Draw background track with subtle gradient
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, "#374151");
    gradient.addColorStop(1, "#4B5563");
    
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.3;
    ctx.stroke();

    // Draw arc segments with softer colors
    const segments = [
      { start: Math.PI, end: Math.PI + Math.PI * 0.283, color: categoryColors.Underweight.primary },
      { start: Math.PI + Math.PI * 0.283, end: Math.PI + Math.PI * 0.5, color: categoryColors.Normal.primary },
      { start: Math.PI + Math.PI * 0.5, end: Math.PI + Math.PI * 0.667, color: categoryColors.Overweight.primary },
      { start: Math.PI + Math.PI * 0.667, end: Math.PI * 2, color: categoryColors.Obese.primary },
    ];

    segments.forEach((seg) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, seg.start, seg.end);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = 18;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.2;
      ctx.stroke();
    });

    // Draw active portion with gradient
    const clampedBmi = Math.min(Math.max(animatedBmi, 10), 40);
    const bmiAngle = Math.PI + ((clampedBmi - 10) / 30) * Math.PI;

    segments.forEach((seg) => {
      const segEnd = Math.min(seg.end, bmiAngle);
      if (segEnd > seg.start) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, seg.start, segEnd);
        
        // Add gradient for active portion
        const gradient = ctx.createLinearGradient(
          cx + radius * Math.cos(seg.start),
          cy + radius * Math.sin(seg.start),
          cx + radius * Math.cos(segEnd),
          cy + radius * Math.sin(segEnd)
        );
        gradient.addColorStop(0, seg.color);
        gradient.addColorStop(1, seg.color + "CC");
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 18;
        ctx.lineCap = "round";
        ctx.globalAlpha = 1;
        ctx.stroke();
      }
    });

    // Draw needle with glow effect
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 8;
    const needleLen = radius - 10;
    const nx = cx + needleLen * Math.cos(bmiAngle);
    const ny = cy + needleLen * Math.sin(bmiAngle);
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();

    // Reset shadow for other elements
    ctx.shadowBlur = 0;

    // Draw center dot with inner glow
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffffff";
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#1F2937";
    ctx.fill();

    // Labels with better positioning and style
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.shadowBlur = 0;
    
    // Value markers
    ctx.fillText("10", cx - radius - 12, cy + 15);
    ctx.fillText("40", cx + radius + 12, cy + 15);
    
    // Category markers with better positioning
    ctx.fillStyle = categoryColors.Underweight.primary;
    ctx.fillText("18.5", cx - radius * 0.7, cy - radius * 0.25);
    
    ctx.fillStyle = categoryColors.Normal.primary;
    ctx.fillText("25", cx - 15, cy - radius - 5);
    
    ctx.fillStyle = categoryColors.Overweight.primary;
    ctx.fillText("30", cx + radius * 0.7, cy - radius * 0.25);
  }, [animatedBmi]);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} width={280} height={160} className="drop-shadow-lg" />
    </div>
  );
}

/* ── Custom SVG History Chart ── */
function HistoryChart({ history }) {
  if (history.length < 2) return null;

  const width = 280;
  const height = 120;
  const padding = 20;

  // Map data chronologically
  const data = history.map(h => h.weight);
  const minW = Math.min(...data);
  const maxW = Math.max(...data);
  const range = maxW - minW || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d - minW) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  return (
    <div className="w-full mb-4 bg-slate-800/30 rounded-xl p-3 border border-slate-700/50 flex flex-col items-center">
      <h3 className="text-slate-300 text-xs font-semibold mb-2 w-full text-left flex items-center gap-1.5">
        <span className="text-indigo-400">📈</span> Weight Timeline
      </h3>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#475569" strokeDasharray="3 3" opacity="0.4"/>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#475569" strokeDasharray="3 3" opacity="0.4"/>
        
        {/* Gradient for area under curve */}
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M ${padding},${height - padding} L ${padding},${points[0] ? points[0].split(',')[1] : 0} ${pathD} L ${width - padding},${height - padding} Z`} fill="url(#chartGradient)" />
        
        {/* Animated Data Line */}
        <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        
        {/* Data Points */}
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1)) * (width - padding * 2);
          const y = height - padding - ((d - minW) / range) * (height - padding * 2);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3.5" fill="#1E293B" stroke="#A78BFA" strokeWidth="2" className="transition-all hover:r-[6px] cursor-pointer" />
              {(i === 0 || i === data.length - 1 || d === minW || d === maxW) && (
                <text x={x} y={y - 8} fill="#9CA3AF" fontSize="9" textAnchor="middle" fontWeight="bold">
                  {d}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between w-full text-[9px] text-slate-500 mt-1 px-4 font-medium uppercase tracking-wider">
        <span>{new Date(history[0].date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
        <span>{new Date(history[history.length - 1].date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
      </div>
    </div>
  );
}

/* ── Main App ── */
function App() {
  const [profiles, setProfiles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bmi_profiles") || "[]");
    } catch {
      return [];
    }
  });
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem("bmi_active_profile") || "");

  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState("metric");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState(null);
  const [editForm, setEditForm] = useState({ weight: "", height: "", age: "", gender: "", unit: "metric" });
  const [reminder, setReminder] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bmi_reminder") || '{"enabled":false,"time":"20:00","lastNotified":""}');
    } catch {
      return { enabled: false, time: "20:00", lastNotified: "" };
    }
  });
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const [monoMode, setMonoMode] = useState(() => localStorage.getItem("bmi_mono_mode") === "1");
  const [targetWeightsByProfile, setTargetWeightsByProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bmi_targets") || "{}");
    } catch {
      return {};
    }
  });

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || null,
    [profiles, activeProfileId]
  );

  const targetWeight = activeProfileId ? targetWeightsByProfile[activeProfileId] || "" : "";

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [history]
  );

  const hasLogToday = useMemo(() => {
    const today = new Date().toDateString();
    return sortedHistory.some((entry) => new Date(entry.date).toDateString() === today);
  }, [sortedHistory]);

  const streakDays = useMemo(() => {
    if (sortedHistory.length === 0) return 0;
    const uniqueDays = [...new Set(sortedHistory.map((entry) => new Date(entry.date).toDateString()))]
      .map((s) => new Date(s))
      .sort((a, b) => b - a);

    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    if (uniqueDays.length > 0) {
      const latest = new Date(uniqueDays[0]);
      latest.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((cursor - latest) / 86400000);
      if (diffDays > 1) return 0;
      if (diffDays === 1) {
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    for (const day of uniqueDays) {
      const normalized = new Date(day);
      normalized.setHours(0, 0, 0, 0);
      if (normalized.getTime() === cursor.getTime()) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else if (normalized.getTime() < cursor.getTime()) {
        break;
      }
    }

    return streak;
  }, [sortedHistory]);

  const weeklyInsights = useMemo(() => {
    if (sortedHistory.length < 2) return null;

    const latest = sortedHistory[sortedHistory.length - 1];
    const latestDate = new Date(latest.date);
    const weekAgoCutoff = new Date(latestDate);
    weekAgoCutoff.setDate(weekAgoCutoff.getDate() - 7);

    const lastWeekEntries = sortedHistory.filter((entry) => new Date(entry.date) >= weekAgoCutoff);
    const baseline = sortedHistory.find((entry) => new Date(entry.date) >= weekAgoCutoff) || sortedHistory[0];

    const weightChange = latest.weight - baseline.weight;
    const bmiAvg = lastWeekEntries.reduce((sum, entry) => sum + entry.bmi, 0) / Math.max(lastWeekEntries.length, 1);
    const trend = weightChange < -0.2 ? "down" : weightChange > 0.2 ? "up" : "flat";

    return {
      logs: lastWeekEntries.length,
      weightChange,
      bmiAvg,
      trend,
    };
  }, [sortedHistory]);

  // Enhanced color palette
  const colors = {
    primary: {
      from: "#6366F1", // Indigo
      to: "#8B5CF6",   // Purple
    },
    secondary: {
      from: "#EC4899", // Pink
      to: "#F43F5E",   // Rose
    },
    background: {
      dark: "#0F172A",  // Slate 900
      medium: "#1E293B", // Slate 800
      light: "#334155",  // Slate 700
    },
    category: {
      Underweight: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-400" },
      Normal: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400" },
      Overweight: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400" },
      Obese: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", dot: "bg-rose-400" },
    }
  };

  useEffect(() => {
    localStorage.setItem("bmi_profiles", JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    if (activeProfileId) {
      localStorage.setItem("bmi_active_profile", activeProfileId);
    } else {
      localStorage.removeItem("bmi_active_profile");
    }
  }, [activeProfileId]);

  useEffect(() => {
    localStorage.setItem("bmi_targets", JSON.stringify(targetWeightsByProfile));
  }, [targetWeightsByProfile]);

  useEffect(() => {
    localStorage.setItem("bmi_mono_mode", monoMode ? "1" : "0");
  }, [monoMode]);

  useEffect(() => {
    localStorage.setItem("bmi_reminder", JSON.stringify(reminder));
  }, [reminder]);

  useEffect(() => {
    if (activeProfile?.name) {
      setName(activeProfile.name);
      loadHistory(activeProfile.id, activeProfile.name);
    } else {
      setHistory([]);
      setResult(null);
    }
  }, [activeProfileId, activeProfile?.name]);

  useEffect(() => {
    if (result) {
      setShowResult(false);
      const t = setTimeout(() => setShowResult(true), 50);
      return () => clearTimeout(t);
    } else {
      setShowResult(false);
    }
  }, [result]);

  useEffect(() => {
    if (hasLogToday) {
      setShowReminderBanner(false);
    }
  }, [hasLogToday]);

  useEffect(() => {
    if (!activeProfileId || !reminder.enabled) return;

    const tick = async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const [h, m] = reminder.time.split(":").map((v) => parseInt(v, 10));
      const due = new Date();
      due.setHours(isNaN(h) ? 20 : h, isNaN(m) ? 0 : m, 0, 0);

      if (now >= due && reminder.lastNotified !== today) {
        const sent = await sendBmiReminderNotification(
          "BMI Check-In",
          `Hi ${activeProfile?.name || "there"}, it is time to log today's health check.`
        );

        if (sent) {
          setShowReminderBanner(true);
          setReminder((prev) => ({ ...prev, lastNotified: today }));
        }
      }
    };

    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [activeProfileId, reminder.enabled, reminder.time, reminder.lastNotified, activeProfile?.name]);

  async function sendTestReminderNotification() {
    await requestNotificationPermission();
    const sent = await sendBmiReminderNotification(
      "BMI Check-In Test",
      `Test reminder for ${activeProfile?.name || "you"}. Notifications are working.`
    );
    if (!sent) {
      setError("Could not send a notification. Check OS notification permissions for this app.");
    }
  }

  function setTargetWeight(value) {
    if (!activeProfileId) return;
    setTargetWeightsByProfile((prev) => ({
      ...prev,
      [activeProfileId]: value,
    }));
  }

  function handleCreateProfile(profile) {
    setProfiles((prev) => [profile, ...prev]);
    setActiveProfileId(profile.id);
  }

  function handleSelectProfile(profileId) {
    setActiveProfileId(profileId);
    setShowHistory(false);
    setResult(null);
    setError("");
  }

  function switchProfile() {
    setActiveProfileId("");
    setResult(null);
    setShowHistory(false);
    setError("");
  }

  async function loadHistory(profileId = activeProfileId, profileName = activeProfile?.name) {
    if (!profileId) {
      setHistory([]);
      return;
    }

    try {
      const entries = await invoke("load_history");
      const normalizedName = (profileName || "").trim().toLowerCase();
      const filtered = Array.isArray(entries)
        ? entries.filter((entry) => {
            if (entry.profile_id) return entry.profile_id === profileId;
            return (entry.name || "").trim().toLowerCase() === normalizedName;
          })
            .map((entry) => ({
              ...entry,
              entry_id: entry.entry_id || entry.date,
            }))
        : [];
      setHistory(filtered);
    } catch {
      setHistory([]);
    }
  }

  async function calculateBmi(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age) || 0;

    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      setError("Please enter valid positive numbers for weight and height.");
      return;
    }

    try {
      const profileName = activeProfile?.name || name.trim();
      const res = await invoke("calculate_bmi", {
        name: profileName,
        gender: gender,
        age: a,
        weight: w,
        height: h,
        unit: unit,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
        const entry = {
          date: new Date().toISOString(),
          entry_id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          profile_id: activeProfileId,
          name: profileName,
          gender: gender,
          age: a,
          bmi: res.bmi,
          category: res.category,
          weight: w,
          height: h,
          unit: unit,
        };
        try {
          await invoke("save_history", { entry });
          await loadHistory(activeProfileId, profileName);
        } catch {
          // silent
        }
      }
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || JSON.stringify(err));
    }
  }

  async function handleClearHistory() {
    if (!activeProfileId) return;
    try {
      await invoke("clear_profile_history", { profileId: activeProfileId });
      setHistory([]);
    } catch {
      // ignore
    }
  }

  async function restoreFromHistory(entry) {
    setError("");

    setUnit(entry.unit || "metric");
    setWeight(String(entry.weight ?? ""));
    setHeight(String(entry.height ?? ""));
    setGender(entry.gender || "");
    setAge(entry.age ? String(entry.age) : "");
    if (entry.name) {
      setName(entry.name);
    }

    try {
      const res = await invoke("calculate_bmi", {
        name: (entry.name || activeProfile?.name || "").trim(),
        gender: entry.gender || "",
        age: entry.age || 0,
        weight: entry.weight,
        height: entry.height,
        unit: entry.unit || "metric",
      });

      if (res.error) {
        setError(res.error);
        return;
      }

      setResult(res);
      setShowHistory(false);
      // Scroll to top so users immediately see restored results card.
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Could not restore this history entry.");
    }
  }

  function startEditEntry(entry) {
    setEditingEntry(entry);
    setEditForm({
      weight: String(entry.weight ?? ""),
      height: String(entry.height ?? ""),
      age: entry.age ? String(entry.age) : "",
      gender: entry.gender || "",
      unit: entry.unit || "metric",
    });
  }

  function cancelEditEntry() {
    setEditingEntry(null);
    setEditForm({ weight: "", height: "", age: "", gender: "", unit: "metric" });
  }

  async function saveEditedEntry() {
    if (!editingEntry) return;

    const w = parseFloat(editForm.weight);
    const h = parseFloat(editForm.height);
    const a = parseInt(editForm.age, 10) || 0;

    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      setError("Please enter valid positive numbers for weight and height.");
      return;
    }

    try {
      const res = await invoke("calculate_bmi", {
        name: (editingEntry.name || activeProfile?.name || "").trim(),
        gender: editForm.gender,
        age: a,
        weight: w,
        height: h,
        unit: editForm.unit,
      });

      if (res.error) {
        setError(res.error);
        return;
      }

      const updatedEntry = {
        ...editingEntry,
        weight: w,
        height: h,
        age: a,
        gender: editForm.gender,
        unit: editForm.unit,
        bmi: res.bmi,
        category: res.category,
      };

      await invoke("update_history_entry", { updatedEntry });
      await loadHistory(activeProfileId, activeProfile?.name);
      setResult(res);
      cancelEditEntry();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Could not update this history entry.");
    }
  }

  function requestDeleteEntry(entry) {
    setPendingDeleteEntry(entry);
  }

  function cancelDeleteEntry() {
    setPendingDeleteEntry(null);
  }

  async function confirmDeleteEntry() {
    if (!pendingDeleteEntry) return;
    try {
      const entryId = pendingDeleteEntry.entry_id || pendingDeleteEntry.date;
      await invoke("delete_history_entry", { entryId });
      if (editingEntry?.entry_id === entryId) {
        cancelEditEntry();
      }
      setPendingDeleteEntry(null);
      await loadHistory(activeProfileId, activeProfile?.name);
    } catch {
      setError("Could not delete this history entry.");
    }
  }

  function getCategoryColor(cat) {
    if (monoMode) return "text-zinc-100";
    return colors.category[cat]?.text || "text-white";
  }

  function getCategoryBg(cat) {
    if (monoMode) return "bg-zinc-900/60";
    return colors.category[cat]?.bg || "bg-gray-500/10";
  }

  function getCategoryBorder(cat) {
    if (monoMode) return "border-zinc-600/60";
    return colors.category[cat]?.border || "border-gray-500/30";
  }

  function getCategoryDot(cat) {
    if (monoMode) return "bg-zinc-200";
    return colors.category[cat]?.dot || "bg-gray-400";
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function reset() {
    setWeight("");
    setHeight("");
    setAge("");
    setResult(null);
    setError("");
  }

  const nutrition = useMemo(() => {
    if (!result) return null;

    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    if (isNaN(w) || isNaN(h) || isNaN(a) || w <= 0 || h <= 0 || a <= 0) return null;

    const weightKg = unit === "metric" ? w : w * 0.45359237;
    const heightCm = unit === "metric" ? h : h * 2.54;

    const genderOffset = gender === "male" ? 5 : gender === "female" ? -161 : -78;
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * a + genderOffset;
    const maintenance = bmr * 1.35;
    const lose = Math.max(maintenance - 450, gender === "male" ? 1500 : 1200);
    const gain = maintenance + 300;

    const proteinPerKg = result.category === "Underweight" ? 1.8 : 1.6;
    const proteinG = weightKg * proteinPerKg;
    const fatG = (maintenance * 0.25) / 9;
    const carbsG = (maintenance * 0.45) / 4;

    return {
      bmr: Math.round(bmr),
      maintenance: Math.round(maintenance),
      lose: Math.round(lose),
      gain: Math.round(gain),
      protein: Math.round(proteinG),
      carbs: Math.round(carbsG),
      fats: Math.round(fatG),
    };
  }, [result, weight, height, age, unit, gender]);

  const inputClass = "w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200";

  if (!activeProfile) {
    return (
      <ProfilePicker
        profiles={profiles}
        onSelectProfile={handleSelectProfile}
        onCreateProfile={handleCreateProfile}
      />
    );
  }

  const pendingDeleteLabel = pendingDeleteEntry
    ? `${pendingDeleteEntry.bmi} (${pendingDeleteEntry.category}) on ${formatDate(pendingDeleteEntry.date)}`
    : "";

  return (
    <div
      className={`min-h-screen flex items-start justify-center p-4 overflow-y-auto transition-colors ${
        monoMode
          ? "bg-gradient-to-br from-black via-zinc-900 to-black text-zinc-100"
          : "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      }`}
    >
      <div className="w-full max-w-md py-6">
        {/* Header with gradient text */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <ProfileAvatar profile={activeProfile} className="w-10 h-10" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Active profile</p>
                <p className="text-sm text-slate-200 font-semibold truncate">{activeProfile.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={switchProfile}
              className="text-xs text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 hover:border-indigo-400/50 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              Switch
            </button>
          </div>

          <div className="text-center">
          <h1
            className={`text-4xl font-bold mb-1 text-transparent bg-clip-text ${
              monoMode
                ? "bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-500"
                : "bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400"
            }`}
          >
            BMI Calculator
          </h1>
          <p className={`${monoMode ? "text-zinc-400" : "text-slate-500"} text-sm`}>Track your health journey</p>

          <button
            type="button"
            onClick={() => setMonoMode((prev) => !prev)}
            aria-label={monoMode ? "Switch to vibrant mode" : "Switch to monochrome mode"}
            title={monoMode ? "Switch to vibrant mode" : "Switch to monochrome mode"}
            className={`mt-3 text-xs rounded-lg px-3 py-1.5 border transition-colors ${
              monoMode
                ? "bg-zinc-800 border-zinc-600 text-zinc-100 hover:bg-zinc-700"
                : "bg-slate-800/70 border-slate-600 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <span className="text-base leading-none">{monoMode ? "◐" : "✦"}</span>
          </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-6">
          {/* Unit Toggle with gradient */}
          <div className="bg-slate-800/80 rounded-xl p-1 mb-5 border border-slate-700/50">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => { setUnit("metric"); setResult(null); setError(""); }}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                  unit === "metric"
                    ? monoMode
                      ? "bg-gradient-to-r from-zinc-700 to-zinc-500 text-white shadow-lg shadow-zinc-700/30"
                      : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                    : monoMode
                      ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                Metric (kg/cm)
              </button>
              <button
                type="button"
                onClick={() => { setUnit("imperial"); setResult(null); setError(""); }}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                  unit === "imperial"
                    ? monoMode
                      ? "bg-gradient-to-r from-zinc-700 to-zinc-500 text-white shadow-lg shadow-zinc-700/30"
                      : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                    : monoMode
                      ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50"
                      : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                Imperial (lbs/in)
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={calculateBmi} className="space-y-4">
            {/* Active profile */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <span className="text-indigo-400">👤</span>
                <span>Profile Name</span>
              </label>
              <input
                type="text"
                value={name}
                readOnly
                className={`${inputClass} opacity-80 cursor-not-allowed`}
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <span className="text-purple-400">⚥</span>
                <span>Gender</span>
              </label>
              <div className="flex gap-2">
                {[
                  { value: "male", label: "♂ Male", activeColor: "from-blue-500 to-indigo-500 shadow-blue-500/25" },
                  { value: "female", label: "♀ Female", activeColor: "from-pink-500 to-rose-500 shadow-pink-500/25" },
                  { value: "other", label: "⚧ Other", activeColor: "from-purple-500 to-violet-500 shadow-purple-500/25" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(gender === opt.value ? "" : opt.value)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-200 border ${
                      gender === opt.value
                        ? `bg-gradient-to-r ${opt.activeColor} text-white border-transparent shadow-lg`
                        : "bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Age */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <span className="text-pink-400">🎂</span>
                <span>Age</span>
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Years"
                className={inputClass}
              />
            </div>

            {/* Weight, Target & Height with icons */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-1">
                  <span className="text-indigo-400">⚖️</span>
                  <span className="truncate">Weight</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder={unit === "metric" ? "kg" : "lbs"}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-1">
                  <span className="text-emerald-400">🎯</span>
                  <span className="truncate">Target</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  placeholder={unit === "metric" ? "kg" : "lbs"}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-1">
                  <span className="text-purple-400">📏</span>
                  <span className="truncate">Height</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder={unit === "metric" ? "cm" : "in"}
                  className={inputClass}
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className={`flex-1 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 active:scale-[0.98] ${
                  monoMode
                    ? "bg-gradient-to-r from-zinc-700 to-zinc-500 hover:from-zinc-600 hover:to-zinc-400 shadow-lg shadow-zinc-700/30"
                    : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                }`}
              >
                Calculate BMI
              </button>
              <button
                type="button"
                onClick={reset}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-3 px-4 rounded-xl transition-all duration-300 active:scale-[0.98] border border-slate-600"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Result with enhanced animations */}
          {result && (
            <div
              className={`mt-6 space-y-4 transition-all duration-500 ease-out ${
                showResult
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            >
              {/* Greeting with gradient */}
              <div className="text-center">
                <p className="text-sm font-medium bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 text-transparent bg-clip-text">
                  {result.greeting}
                </p>
              </div>

              {/* BMI Gauge Card */}
              <div className={`rounded-2xl p-4 border ${getCategoryBorder(result.category)} ${getCategoryBg(result.category)} backdrop-blur-sm`}>
                <BmiGauge bmi={result.bmi} category={result.category} />
                <div className="text-center -mt-2">
                  <p className={`text-5xl font-bold ${getCategoryColor(result.category)} drop-shadow-lg`}>
                    {result.bmi}
                  </p>
                  <p className={`text-lg font-semibold mt-1 ${getCategoryColor(result.category)}`}>
                    {result.category}
                  </p>
                  <p className="text-slate-400 text-sm mt-2 leading-relaxed">{result.description}</p>
                </div>
              </div>

              {/* Goal Progress Bar */}
              {targetWeight && parseFloat(targetWeight) > 0 && (() => {
                const targetW = parseFloat(targetWeight);
                const currentW = parseFloat(weight);
                const initialW = history.length > 0 ? history[0].weight : currentW;
                
                let progress = 0;
                let isLosing = targetW < initialW;
                
                if (initialW !== targetW) {
                  if (isLosing) {
                     progress = ((initialW - Math.max(currentW, targetW)) / (initialW - targetW)) * 100;
                  } else {
                     progress = ((Math.min(currentW, targetW) - initialW) / (targetW - initialW)) * 100;
                  }
                }
                progress = Math.max(0, Math.min(100, progress));
                const diff = (currentW - targetW).toFixed(1);
                
                let statusText = "";
                if (Math.abs(currentW - targetW) < 0.2) statusText = "Goal Reached! 🎉";
                else if (currentW > targetW) statusText = `${diff} ${result.weight_unit} to lose`;
                else statusText = `${Math.abs(diff).toFixed(1)} ${result.weight_unit} to gain`;

                return (
                  <div
                    className={`bg-slate-800/30 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50 transition-all duration-500 delay-75 hover:border-indigo-500/30 ${
                      showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  >
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-xl">🎯</span>
                        <h3 className="text-white text-sm font-semibold">Goal Progress</h3>
                      </div>
                      <span className="text-emerald-400 text-xs font-bold">{statusText}</span>
                    </div>
                    <div className="h-4 w-full bg-slate-700/50 rounded-full overflow-hidden mt-3 relative">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out rounded-full"
                        style={{ width: `${showResult ? progress : 0}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-medium px-1 uppercase tracking-wider">
                      <span>Start: {initialW}</span>
                      <span>Target: {targetW}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Calorie and Macro Suggestions */}
              {nutrition && (
                <div
                  className={`bg-slate-800/30 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50 transition-all duration-500 delay-125 hover:border-indigo-500/30 ${
                    showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-amber-300 text-xl">🍎</span>
                    <h3 className="text-white text-sm font-semibold">Calorie & Macro Guide</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/50">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Maintain</p>
                      <p className="text-emerald-300 font-bold text-sm">{nutrition.maintenance}</p>
                      <p className="text-[10px] text-slate-500">kcal/day</p>
                    </div>
                    <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/50">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Lose</p>
                      <p className="text-rose-300 font-bold text-sm">{nutrition.lose}</p>
                      <p className="text-[10px] text-slate-500">kcal/day</p>
                    </div>
                    <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/50">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Gain</p>
                      <p className="text-indigo-300 font-bold text-sm">{nutrition.gain}</p>
                      <p className="text-[10px] text-slate-500">kcal/day</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center bg-slate-900/30 rounded-lg p-2 border border-slate-700/40">
                      <p className="text-[10px] text-slate-500 uppercase">Protein</p>
                      <p className="text-slate-100 font-semibold text-sm">{nutrition.protein}g</p>
                    </div>
                    <div className="text-center bg-slate-900/30 rounded-lg p-2 border border-slate-700/40">
                      <p className="text-[10px] text-slate-500 uppercase">Carbs</p>
                      <p className="text-slate-100 font-semibold text-sm">{nutrition.carbs}g</p>
                    </div>
                    <div className="text-center bg-slate-900/30 rounded-lg p-2 border border-slate-700/40">
                      <p className="text-[10px] text-slate-500 uppercase">Fats</p>
                      <p className="text-slate-100 font-semibold text-sm">{nutrition.fats}g</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 mt-2">BMR estimate: {nutrition.bmr} kcal/day</p>
                </div>
              )}

              {/* Healthy Weight Range with glass effect */}
              <div
                className={`bg-slate-800/30 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50 transition-all duration-500 delay-150 hover:border-indigo-500/30 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-emerald-400 text-xl">✓</span>
                  <h3 className="text-white text-sm font-semibold">Healthy Weight Range</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  For your height, maintain a healthy weight between{" "}
                  <span className="text-emerald-400 font-semibold">{result.healthy_weight_min} {result.weight_unit}</span>
                  {" "}and{" "}
                  <span className="text-emerald-400 font-semibold">{result.healthy_weight_max} {result.weight_unit}</span>
                </p>
              </div>

              {/* Lifestyle Tips with staggered animations */}
              <div
                className={`bg-slate-800/30 backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50 transition-all duration-500 delay-300 hover:border-indigo-500/30 ${
                  showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-indigo-400 text-xl">✨</span>
                  <h3 className="text-white text-sm font-semibold">Lifestyle Tips</h3>
                </div>
                <ul className="space-y-3">
                  {result.tips.map((tip, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-3 transition-all duration-300 group`}
                      style={{ 
                        transitionDelay: `${400 + i * 80}ms`, 
                        opacity: showResult ? 1 : 0, 
                        transform: showResult ? "translateX(0)" : "translateX(-10px)" 
                      }}
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${getCategoryDot(result.category)} group-hover:scale-125 transition-transform`}></span>
                      <span className="text-slate-300 text-sm leading-relaxed group-hover:text-white transition-colors">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* History Section with glass morphism */}
        <div className="mt-4">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="bg-slate-800/35 backdrop-blur-xl rounded-xl border border-slate-700/50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Streak</p>
                <p className="text-lg font-bold text-amber-300">{streakDays} day{streakDays === 1 ? "" : "s"}</p>
              </div>

              <div className="bg-slate-800/35 backdrop-blur-xl rounded-xl border border-slate-700/50 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Reminder</p>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={reminder.enabled}
                      onChange={async (e) => {
                        const enabled = e.target.checked;
                        setReminder((prev) => ({
                          ...prev,
                          enabled,
                          // Reset daily lock so users can test immediately after enabling.
                          lastNotified: enabled ? "" : prev.lastNotified,
                        }));
                        if (enabled) {
                          await requestNotificationPermission();
                        }
                      }}
                    />
                    <span className={`w-8 h-4 rounded-full transition-colors ${reminder.enabled ? "bg-emerald-500" : "bg-slate-600"}`}>
                      <span className={`block w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${reminder.enabled ? "translate-x-4" : "translate-x-0.5"}`}></span>
                    </span>
                  </label>
                </div>
                <input
                  type="time"
                  value={reminder.time}
                  onChange={(e) =>
                    setReminder((prev) => ({
                      ...prev,
                      time: e.target.value,
                      // Allow trigger again for newly selected time.
                      lastNotified: "",
                    }))
                  }
                  className="mt-2 w-full bg-slate-900/40 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                />
                {showDevNotificationTest && (
                  <button
                    type="button"
                    onClick={sendTestReminderNotification}
                    className="mt-2 w-full text-[10px] uppercase tracking-wider text-slate-200 bg-slate-700/60 hover:bg-slate-600/70 border border-slate-600 rounded-lg px-2 py-1.5"
                  >
                    Test Notification
                  </button>
                )}
              </div>
            </div>

            {showReminderBanner && (
              <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-300 flex items-center justify-between gap-2">
                <span>It is check-in time. Log today\'s BMI to keep your streak alive.</span>
                <button
                  type="button"
                  onClick={() => setShowReminderBanner(false)}
                  className="text-amber-200 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            )}

            {weeklyInsights && (
              <div className="mb-3 bg-slate-800/35 backdrop-blur-xl rounded-xl border border-slate-700/50 px-3 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-200">Weekly Insights</p>
                  <span className="text-[10px] text-slate-400">last 7 days</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/40">
                    <p className="text-[10px] text-slate-500 uppercase">Logs</p>
                    <p className="text-sm font-semibold text-slate-100">{weeklyInsights.logs}</p>
                  </div>
                  <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/40">
                    <p className="text-[10px] text-slate-500 uppercase">BMI Avg</p>
                    <p className="text-sm font-semibold text-slate-100">{weeklyInsights.bmiAvg.toFixed(1)}</p>
                  </div>
                  <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-700/40">
                    <p className="text-[10px] text-slate-500 uppercase">Weight</p>
                    <p className={`text-sm font-semibold ${weeklyInsights.weightChange < 0 ? "text-emerald-300" : weeklyInsights.weightChange > 0 ? "text-rose-300" : "text-slate-200"}`}>
                      {weeklyInsights.weightChange > 0 ? "+" : ""}{weeklyInsights.weightChange.toFixed(1)}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Trend: {weeklyInsights.trend === "down" ? "Improving (downward)" : weeklyInsights.trend === "up" ? "Upward" : "Stable"}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between bg-slate-800/40 backdrop-blur-xl rounded-xl border border-slate-700/50 px-4 py-3 text-sm text-slate-300 hover:text-white transition-all hover:border-indigo-500/50 group"
            >
              <span className="font-medium flex items-center gap-2">
                <span className="text-indigo-400">📊</span>
                {activeProfile.name}'s History ({history.length})
              </span>
              <span className={`transition-all duration-300 ${showHistory ? "rotate-180" : ""} group-hover:text-indigo-400`}>
                ▼
              </span>
            </button>

            {showHistory && (
              <div className="mt-2 bg-slate-800/40 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 space-y-4">
                {editingEntry && (
                  <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-200">Edit Entry</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={editForm.weight}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, weight: e.target.value }))}
                        placeholder="Weight"
                        className="bg-slate-800/70 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                      />
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={editForm.height}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, height: e.target.value }))}
                        placeholder="Height"
                        className="bg-slate-800/70 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                      />
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={editForm.age}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, age: e.target.value }))}
                        placeholder="Age"
                        className="bg-slate-800/70 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                      />
                      <select
                        value={editForm.gender}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value }))}
                        className="bg-slate-800/70 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                      >
                        <option value="">Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={saveEditedEntry}
                        className="text-xs bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditEntry}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                
                <HistoryChart history={history} />

                {history.length === 0 && (
                  <p className="text-xs text-slate-400 bg-slate-900/30 border border-slate-700/40 rounded-lg px-3 py-2">
                    No history yet. Calculate your BMI to start building insights.
                  </p>
                )}

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {[...history].reverse().map((entry, i) => (
                    <div
                      key={i} 
                      onClick={() => restoreFromHistory(entry)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          restoreFromHistory(entry);
                        }
                      }}
                      className="w-full flex items-center justify-between gap-3 bg-slate-700/30 rounded-lg px-3 py-2 hover:bg-slate-700/50 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${getCategoryDot(entry.category)} group-hover:scale-125 transition-transform`}></span>
                        <div className="min-w-0 text-left">
                          <span className={`text-sm font-semibold ${getCategoryColor(entry.category)}`}>{entry.bmi}</span>
                          <span className="text-slate-400 text-xs ml-2">{entry.category}</span>
                          {entry.name && (
                            <span className="text-slate-500 text-xs ml-2 inline-block truncate max-w-[120px] align-middle">- {entry.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(entry.date)}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditEntry(entry);
                          }}
                          className="text-[10px] px-2 py-1 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-600/40"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteEntry(entry);
                          }}
                          className="text-[10px] px-2 py-1 rounded-md border border-rose-600/50 text-rose-300 hover:bg-rose-500/20"
                        >
                          Del
                        </button>
                      </div>
                    </div>
                ))}
                </div>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="w-full mt-2 text-xs text-rose-400/70 hover:text-rose-400 transition-colors py-2 hover:bg-rose-500/10 rounded-lg"
                >
                  Clear History
                </button>
              </div>
            )}
          </div>
      </div>

      {pendingDeleteEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700/70 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Delete History Entry?</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              This action cannot be undone. You are about to remove <span className="text-slate-100">{pendingDeleteLabel}</span>.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelDeleteEntry}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEntry}
                className="text-xs px-3 py-1.5 rounded-lg border border-rose-600/70 bg-rose-600/20 text-rose-200 hover:bg-rose-600/35"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;