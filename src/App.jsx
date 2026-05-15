import { useState, useEffect } from "react";

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ialulmvdzzgfucspwluf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbHVsbXZkenpnZnVjc3B3bHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODc3MDEsImV4cCI6MjA5NDM2MzcwMX0.wWX0GXlU5OoVg8lxNXRR_0lM63Z2APjKAhLzDG0xAXM";

const sb = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
    },
    ...opts,
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const api = {
  getEmployees: () => sb("employees?select=*"),
  getAttendance: (empId) => sb(`attendance?employee_id=eq.${empId}&select=*&order=date.desc&limit=30`),
  getAllAttendance: () => sb("attendance?select=*&order=date.desc&limit=200"),
  getLeaves: (empId) => sb(`leave_requests?employee_id=eq.${empId}&select=*&order=created_at.desc`),
  getAllLeaves: () => sb("leave_requests?select=*&order=created_at.desc"),
  checkIn: (empId, time, loc) => sb("attendance", {
    method: "POST",
    body: JSON.stringify({
      employee_id: empId,
      date: new Date().toISOString().slice(0, 10),
      check_in: time,
      check_in_lat: loc?.lat ?? null,
      check_in_lng: loc?.lng ?? null,
      check_in_acc: loc?.acc ?? null,
      status: "出勤中",
    }),
  }),
  checkOut: (id, time, workMins, loc) => sb(`attendance?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      check_out: time,
      check_out_lat: loc?.lat ?? null,
      check_out_lng: loc?.lng ?? null,
      check_out_acc: loc?.acc ?? null,
      work_mins: workMins,
      status: "退勤済",
    }),
  }),
  updateBreak: (id, breakMins) => sb(`attendance?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ break_mins: breakMins }),
  }),
  createLeave: (data) => sb("leave_requests", { method: "POST", body: JSON.stringify(data) }),
  updateLeaveStatus: (id, status) => sb(`leave_requests?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
};

// ── 佐野工業カラーパレット ────────────────────────────────────────────────────
const C = {
  // ベース
  bg:        "#0a0e1a",
  panel:     "#0d1424",
  card:      "#111c30",
  cardHover: "#162440",
  border:    "#1e2d4a",
  borderLight:"#2a3f60",
  // ブランドブルー
  primary:   "#1560bd",
  primaryLt: "#1e7ae0",
  primarySoft:"#0d2a5c",
  accent:    "#3b9eff",
  accentSoft:"#0a2040",
  steel:     "#4a7fa5",
  // ステータス
  green:     "#00c896",
  greenSoft: "#002a1f",
  red:       "#ff5252",
  redSoft:   "#2a0a0a",
  yellow:    "#ffb300",
  yellowSoft:"#2a1a00",
  // テキスト
  text:      "#e8edf5",
  textSub:   "#8fa8c8",
  muted:     "#4a6080",
  // 特殊
  gold:      "#c8a000",
  gridLine:  "#1a2840",
};

const nowStr = () => new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (s) => new Date(s).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
const hhmm = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;
// ── GPS ───────────────────────────────────────────────────────────────────────
const getLocation = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 0 }
    );
  });

const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`,
      { headers: { "User-Agent": "SanoKogyo-Kintai/1.0" } }
    );
    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.county || "";
    const state = a.state || a.province || "";
    return city ? `${state} ${city}`.trim() : state || "不明";
  } catch {
    return null;
  }
};

const GpsTag = ({ lat, lng, loading }) => {
  const [place, setPlace] = useState(null);
  useEffect(() => {
    if (lat && lng) reverseGeocode(lat, lng).then(setPlace);
  }, [lat, lng]);
  if (loading) return <span style={{ color: C.yellow, fontSize: 11 }}>⟳ GPS取得中…</span>;
  if (!lat) return <span style={{ color: C.muted, fontSize: 11 }}>—</span>;
  return (
    <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
      style={{ color: C.accent, fontSize: 11, textDecoration: "none" }}>
      📍 {place || "取得中…"}
    </a>
  );
};

// ── 共通UI ────────────────────────────────────────────────────────────────────
const Badge = ({ label, color = C.accent }) => (
  <span style={{ background: color + "28", color, padding: "3px 12px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", border: `1px solid ${color}44` }}>{label}</span>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 24px", position: "relative", overflow: "hidden", ...style }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${C.primary}, ${C.accent})` }} />
    {children}
  </div>
);

const StatBox = ({ label, value, sub, accent = C.accent, icon }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "18px 20px", flex: 1, minWidth: 140, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}88, ${accent})` }} />
    <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 32, opacity: 0.06 }}>{icon}</div>
    <div style={{ color: C.textSub, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
    <div style={{ color: accent, fontSize: 26, fontWeight: 900, fontFamily: "monospace", letterSpacing: "-1px" }}>{value}</div>
    {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>}
  </div>
);

const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, flexDirection: "column", gap: 12 }}>
    <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <span style={{ color: C.muted, fontSize: 12 }}>読み込み中…</span>
  </div>
);

// ── 打刻画面 ──────────────────────────────────────────────────────────────────
function PunchView({ currentEmp }) {
  const [clock, setClock] = useState(new Date());
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [breakStart, setBreakStart] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);

  const loadToday = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const rows = await sb(`attendance?employee_id=eq.${currentEmp.id}&date=eq.${todayStr}&select=*`);
      setToday(rows[0] || null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { loadToday(); }, [currentEmp.id]);

  const punch = async (type) => {
    setError(null);
    try {
      if (type === "checkIn") {
        setGpsLoading(true);
        const loc = await getLocation();
        setGpsLoading(false);
        await api.checkIn(currentEmp.id, nowStr(), loc);
        await loadToday();
      } else if (type === "break") {
        setOnBreak(true); setBreakStart(new Date());
      } else if (type === "resume") {
        setOnBreak(false);
        const mins = Math.round((new Date() - breakStart) / 60000);
        await api.updateBreak(today.id, (today.break_mins || 0) + mins);
        await loadToday();
      } else if (type === "checkOut") {
        setGpsLoading(true);
        const loc = await getLocation();
        setGpsLoading(false);
        const [h, m] = today.check_in.slice(0, 5).split(":").map(Number);
        const workMins = (clock.getHours() * 60 + clock.getMinutes()) - (h * 60 + m) - (today.break_mins || 0);
        await api.checkOut(today.id, nowStr(), workMins, loc);
        await loadToday();
      }
    } catch (e) { setError(e.message); setGpsLoading(false); }
  };

  const PunchBtn = ({ label, sublabel, color, bg, border, onClick, disabled, icon }) => (
    <button onClick={onClick} disabled={disabled || gpsLoading} style={{
      background: disabled || gpsLoading ? C.panel : bg,
      color: disabled || gpsLoading ? C.muted : color,
      border: `2px solid ${disabled || gpsLoading ? C.border : border}`,
      borderRadius: 10, padding: "16px 24px", fontWeight: 800, fontSize: 15,
      cursor: disabled || gpsLoading ? "not-allowed" : "pointer",
      opacity: disabled || gpsLoading ? 0.4 : 1,
      transition: "all .15s",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 110,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span>{label}</span>
      {sublabel && <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 500 }}>{sublabel}</span>}
    </button>
  );

  const statusColor = today?.status === "退勤済" ? C.muted : today?.status === "出勤中" ? C.green : C.yellow;

  return (
    <div>
      {/* 時計セクション */}
      <div style={{
        background: `linear-gradient(135deg, ${C.primarySoft}, ${C.accentSoft})`,
        border: `1px solid ${C.borderLight}`,
        borderRadius: 12, padding: "32px 24px", textAlign: "center", marginBottom: 24,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: C.accent + "08", borderRadius: "50%", border: `1px solid ${C.accent}18` }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, background: C.primary + "10", borderRadius: "50%" }} />
        <div style={{ color: C.textSub, fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8 }}>{fmtDate(clock)}</div>
        <div style={{ fontSize: 68, fontWeight: 900, letterSpacing: "-3px", color: C.text, fontFamily: "monospace", lineHeight: 1, marginBottom: 8 }}>
          {clock.toLocaleTimeString("ja-JP")}
        </div>
        <div style={{ color: C.textSub, fontSize: 14, fontWeight: 600 }}>
          {currentEmp.name} <span style={{ color: C.muted, fontWeight: 400 }}>／ {currentEmp.dept}</span>
        </div>
        {today && (
          <div style={{ marginTop: 12 }}>
            <Badge label={today.status} color={statusColor} />
          </div>
        )}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* 本日の記録 */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>本日の勤務記録</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              {[
                { label: "出勤時刻", val: today?.check_in?.slice(0,5) || "--:--", color: C.green },
                { label: "休憩時間", val: today ? `${today.break_mins || 0}分` : "--", color: C.yellow },
                { label: "退勤時刻", val: today?.check_out?.slice(0,5) || "--:--", color: C.accent },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: "center", background: C.panel, borderRadius: 8, padding: "12px 8px", border: `1px solid ${C.border}` }}>
                  <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                  <div style={{ color, fontWeight: 800, fontSize: 20, fontFamily: "monospace" }}>{val}</div>
                </div>
              ))}
            </div>
            {/* GPS情報 */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {today?.check_in && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.muted, fontSize: 10, fontWeight: 700, minWidth: 40, textTransform: "uppercase" }}>出勤</span>
                  <GpsTag lat={today.check_in_lat} lng={today.check_in_lng} acc={today.check_in_acc} loading={gpsLoading && !today.check_out} />
                </div>
              )}
              {today?.check_out && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.muted, fontSize: 10, fontWeight: 700, minWidth: 40, textTransform: "uppercase" }}>退勤</span>
                  <GpsTag lat={today.check_out_lat} lng={today.check_out_lng} acc={today.check_out_acc} />
                </div>
              )}
              {!today && !gpsLoading && (
                <span style={{ color: C.muted, fontSize: 11 }}>打刻時にGPS位置を自動記録します</span>
              )}
              {gpsLoading && <GpsTag loading={true} />}
            </div>
          </Card>

          {error && (
            <div style={{ background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "10px 16px", color: C.red, marginBottom: 16, fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          {/* 打刻ボタン */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <PunchBtn icon="🟢" label="出勤" sublabel="CHECK IN" color={C.green} bg={C.greenSoft} border={C.green} onClick={() => punch("checkIn")} disabled={!!today} />
            <PunchBtn icon="☕" label="休憩開始" sublabel="BREAK" color={C.yellow} bg={C.yellowSoft} border={C.yellow} onClick={() => punch("break")} disabled={!today || onBreak || !!today?.check_out} />
            <PunchBtn icon="▶" label="休憩終了" sublabel="RESUME" color={C.accent} bg={C.accentSoft} border={C.accent} onClick={() => punch("resume")} disabled={!onBreak} />
            <PunchBtn icon="🔴" label="退勤" sublabel="CHECK OUT" color={C.red} bg={C.redSoft} border={C.red} onClick={() => punch("checkOut")} disabled={!today || !!today?.check_out} />
          </div>
        </>
      )}
    </div>
  );
}

// ── 勤怠履歴 ─────────────────────────────────────────────────────────────────
function HistoryView({ currentEmp, employees, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEmpId, setFilterEmpId] = useState(currentEmp.id);

  useEffect(() => {
    setLoading(true);
    api.getAttendance(isAdmin ? filterEmpId : currentEmp.id).then(setRows).finally(() => setLoading(false));
  }, [filterEmpId, isAdmin]);

  const totalWork = rows.reduce((s, r) => s + (r.work_mins || 0), 0);
  const avgWork = rows.length ? Math.round(totalWork / rows.length) : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatBox label="今月の総労働時間" value={hhmm(totalWork)} accent={C.accent} icon="⏱" />
        <StatBox label="1日平均労働時間" value={hhmm(avgWork)} accent={C.green} icon="📊" />
        <StatBox label="出勤日数" value={`${rows.length}日`} accent={C.yellow} icon="📅" />
      </div>

      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <select value={filterEmpId} onChange={(e) => setFilterEmpId(e.target.value)}
            style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 14 }}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "auto", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${C.primary}, ${C.accent})` }} />
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.panel }}>
                {["日付","出勤","出勤地点","退勤","退勤地点","休憩","労働時間","状態"].map((h) => (
                  <th key={h} style={{ padding: "13px 16px", textAlign: "left", color: C.textSub, fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.gridLine}`, background: i % 2 === 0 ? "transparent" : C.panel + "60" }}>
                  <td style={{ padding: "12px 16px", color: C.textSub, whiteSpace: "nowrap", fontWeight: 600 }}>{fmtDate(r.date)}</td>
                  <td style={{ padding: "12px 16px", color: C.green, fontFamily: "monospace", fontWeight: 700 }}>{r.check_in?.slice(0,5) || "--"}</td>
                  <td style={{ padding: "12px 16px" }}><GpsTag lat={r.check_in_lat} lng={r.check_in_lng} acc={r.check_in_acc} /></td>
                  <td style={{ padding: "12px 16px", color: C.accent, fontFamily: "monospace", fontWeight: 700 }}>{r.check_out?.slice(0,5) || "--:--"}</td>
                  <td style={{ padding: "12px 16px" }}><GpsTag lat={r.check_out_lat} lng={r.check_out_lng} acc={r.check_out_acc} /></td>
                  <td style={{ padding: "12px 16px", color: C.muted }}>{r.break_mins || 0}分</td>
                  <td style={{ padding: "12px 16px", color: C.yellow, fontWeight: 800, fontFamily: "monospace" }}>{r.work_mins ? hhmm(r.work_mins) : "--"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge label={r.status} color={r.status === "出勤中" ? C.green : r.status === "退勤済" ? C.steel : C.yellow} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: C.muted }}>データがありません</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 休暇申請 ─────────────────────────────────────────────────────────────────
function LeaveView({ currentEmp, employees, isAdmin }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "有給休暇", from: "", to: "" });
  const [submitting, setSubmitting] = useState(false);

  const loadLeaves = async () => {
    setLoading(true);
    const data = isAdmin ? await api.getAllLeaves() : await api.getLeaves(currentEmp.id);
    setLeaves(data);
    setLoading(false);
  };

  useEffect(() => { loadLeaves(); }, [isAdmin]);

  const submit = async () => {
    if (!form.from || !form.to) return;
    setSubmitting(true);
    const days = Math.round((new Date(form.to) - new Date(form.from)) / 86400000) + 1;
    await api.createLeave({ employee_id: currentEmp.id, type: form.type, from_date: form.from, to_date: form.to, days, status: "申請中" });
    setForm({ type: "有給休暇", from: "", to: "" });
    setShowForm(false);
    setSubmitting(false);
    await loadLeaves();
  };

  const updateStatus = async (id, status) => { await api.upd