import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

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

/* ── Main App ── */
function App() {
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
    loadHistory();
  }, []);

  useEffect(() => {
    if (result) {
      setShowResult(false);
      const t = setTimeout(() => setShowResult(true), 50);
      return () => clearTimeout(t);
    } else {
      setShowResult(false);
    }
  }, [result]);

  async function loadHistory() {
    try {
      const entries = await invoke("load_history");
      setHistory(entries);
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
      const res = await invoke("calculate_bmi", {
        name: name.trim(),
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
          name: name.trim(),
          bmi: res.bmi,
          category: res.category,
          weight: w,
          height: h,
          unit: unit,
        };
        try {
          await invoke("save_history", { entry });
          await loadHistory();
        } catch {
          // silent
        }
      }
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || JSON.stringify(err));
    }
  }

  async function handleClearHistory() {
    try {
      await invoke("clear_history");
      setHistory([]);
    } catch {
      // ignore
    }
  }

  function getCategoryColor(cat) {
    return colors.category[cat]?.text || "text-white";
  }

  function getCategoryBg(cat) {
    return colors.category[cat]?.bg || "bg-gray-500/10";
  }

  function getCategoryBorder(cat) {
    return colors.category[cat]?.border || "border-gray-500/30";
  }

  function getCategoryDot(cat) {
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

  const inputClass = "w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md py-6">
        {/* Header with gradient text */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
            BMI Calculator
          </h1>
          <p className="text-slate-500 text-sm">Track your health journey</p>
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
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25"
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
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                Imperial (lbs/in)
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={calculateBmi} className="space-y-4">
            {/* Name with icon */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <span className="text-indigo-400">👤</span>
                <span>Your Name</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className={inputClass}
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

            {/* Weight & Height with icons */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                  <span className="text-indigo-400">⚖️</span>
                  <span>Weight</span>
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
                <label className="block text-slate-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                  <span className="text-purple-400">📏</span>
                  <span>Height</span>
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
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98]"
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
        {history.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between bg-slate-800/40 backdrop-blur-xl rounded-xl border border-slate-700/50 px-4 py-3 text-sm text-slate-300 hover:text-white transition-all hover:border-indigo-500/50 group"
            >
              <span className="font-medium flex items-center gap-2">
                <span className="text-indigo-400">📊</span>
                BMI History ({history.length})
              </span>
              <span className={`transition-all duration-300 ${showHistory ? "rotate-180" : ""} group-hover:text-indigo-400`}>
                ▼
              </span>
            </button>

            {showHistory && (
              <div className="mt-2 bg-slate-800/40 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4 space-y-2">
                {[...history].reverse().map((entry, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2 hover:bg-slate-700/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${getCategoryDot(entry.category)} group-hover:scale-125 transition-transform`}></span>
                      <div>
                        <span className={`text-sm font-semibold ${getCategoryColor(entry.category)}`}>
                          {entry.bmi}
                        </span>
                        <span className="text-slate-500 text-xs ml-2">{entry.category}</span>
                        {entry.name && (
                          <span className="text-slate-600 text-xs ml-2">— {entry.name}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs">{formatDate(entry.date)}</span>
                  </div>
                ))}
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
        )}
      </div>
    </div>
  );
}

export default App;