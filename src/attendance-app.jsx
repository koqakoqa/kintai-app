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

// ── Palette & helpers ─────────────────────────────────────────────────────────
const COLORS = {
  bg: "#0f1117", panel: "#16181f", card: "#1c1f2a", border: "#252836",
  accent: "#4f8ef7", accentSoft: "#1e2d4f",
  green: "#22c55e", greenSoft: "#14291e",
  red: "#f87171", redSoft: "#2d1515",
  yellow: "#fbbf24", yellowSoft: "#2d2208",
  muted: "#6b7280", text: "#e2e8f0", textSub: "#94a3b8",
};

const nowStr = () => new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (s) => new Date(s).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
const hhmm = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;
const fmtCoord = (lat, lng) => lat ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : null;

// ── Sub-components ────────────────────────────────────────────────────────────
const Badge = ({ label, color = COLORS.accent }) => (
  <span style={{ background: color + "22", color, padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{label}</span>
);
const Card = ({ children, style = {} }) => (
  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "20px 24px", ...style }}>{children}</div>
);
const StatBox = ({ label, value, sub, accent = COLORS.accent }) => (
  <Card style={{ flex: 1, minWidth: 140 }}>
    <div style={{ color: COLORS.textSub, fontSize: 12, marginBottom: 6 }}>{label}</div>
    <div style={{ color: accent, fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>}
  </Card>
);
const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
    <div style={{ width: 32, height: 32, border: `3px solid ${COLORS.border}`, borderTop: `3px solid ${COLORS.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  </div>
);

// ── GPS helper ────────────────────────────────────────────────────────────────
const getLocation = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 0 }
    );
  });

const GpsTag = ({ lat, lng, acc, loading }) => {
  if (loading) return <span style={{ color: COLORS.yellow, fontSize: 11 }}>⟳ GPS取得中…</span>;
  if (!lat) return <span style={{ color: COLORS.muted, fontSize: 11 }}>—</span>;
  return (
    <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
      style={{ color: COLORS.accent, fontSize: 11, textDecoration: "none" }}>
      📍 {fmtCoord(lat, lng)} <span style={{ color: COLORS.muted }}>±{acc}m</span>
    </a>
  );
};

// ── Punch View ────────────────────────────────────────────────────────────────
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

  const Btn = ({ label, color, bg, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled || gpsLoading} style={{
      background: disabled || gpsLoading ? COLORS.border : bg,
      color: disabled || gpsLoading ? COLORS.muted : color,
      border: "none", borderRadius: 12, padding: "14px 28px", fontWeight: 700, fontSize: 15,
      cursor: disabled || gpsLoading ? "not-allowed" : "pointer", opacity: disabled || gpsLoading ? 0.5 : 1,
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ color: COLORS.textSub, fontSize: 13 }}>{fmtDate(new Date())}</div>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: "-2px", color: COLORS.text, fontFamily: "monospace" }}>
          {clock.toLocaleTimeString("ja-JP")}
        </div>
        <div style={{ color: COLORS.textSub, fontSize: 14 }}>{currentEmp.name}（{currentEmp.dept}）</div>
      </div>

      {loading ? <Spinner /> : (
        <>
          <Card style={{ maxWidth: 520, margin: "0 auto 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: COLORS.textSub, fontSize: 13 }}>本日の状況</span>
              {today ? <Badge label={today.status} color={today.status === "退勤済" ? COLORS.muted : COLORS.green} /> : <Badge label="未打刻" color={COLORS.yellow} />}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[
                { label: "出勤", val: today?.check_in?.slice(0,5) || "--:--" },
                { label: "休憩", val: today ? `${today.break_mins || 0}分` : "--" },
                { label: "退勤", val: today?.check_out?.slice(0,5) || "--:--" },
              ].map(({ label, val }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ color: COLORS.muted, fontSize: 11 }}>{label}</div>
                  <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 18, fontFamily: "monospace" }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {today?.check_in && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: COLORS.muted, fontSize: 11, minWidth: 36 }}>出勤</span>
                  <GpsTag lat={today.check_in_lat} lng={today.check_in_lng} acc={today.check_in_acc} loading={gpsLoading && !today.check_out} />
                </div>
              )}
              {today?.check_out && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: COLORS.muted, fontSize: 11, minWidth: 36 }}>退勤</span>
                  <GpsTag lat={today.check_out_lat} lng={today.check_out_lng} acc={today.check_out_acc} />
                </div>
              )}
              {!today && gpsLoading && <GpsTag loading={true} />}
            </div>
          </Card>

          {error && <div style={{ color: COLORS.red, textAlign: "center", marginBottom: 12, fontSize: 13 }}>⚠ {error}</div>}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Btn label="🟢 出勤" color={COLORS.green} bg={COLORS.greenSoft} onClick={() => punch("checkIn")} disabled={!!today} />
            <Btn label="☕ 休憩開始" color={COLORS.yellow} bg={COLORS.yellowSoft} onClick={() => punch("break")} disabled={!today || onBreak || !!today?.check_out} />
            <Btn label="▶ 休憩終了" color={COLORS.accent} bg={COLORS.accentSoft} onClick={() => punch("resume")} disabled={!onBreak} />
            <Btn label="🔴 退勤" color={COLORS.red} bg={COLORS.redSoft} onClick={() => punch("checkOut")} disabled={!today || !!today?.check_out} />
          </div>
          <div style={{ textAlign: "center", marginTop: 14, color: COLORS.muted, fontSize: 11 }}>
            出勤・退勤打刻時にGPS位置情報を自動取得・Supabaseに保存します
          </div>
        </>
      )}
    </div>
  );
}

// ── History View ──────────────────────────────────────────────────────────────
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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="今月の総労働時間" value={hhmm(totalWork)} accent={COLORS.accent} />
        <StatBox label="1日平均" value={hhmm(avgWork)} accent={COLORS.green} />
        <StatBox label="出勤日数" value={`${rows.length}日`} accent={COLORS.yellow} />
      </div>
      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <select value={filterEmpId} onChange={(e) => setFilterEmpId(e.target.value)}
            style={{ background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 14 }}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}
      {loading ? <Spinner /> : (
        <Card style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: COLORS.panel }}>
                {["日付","出勤","出勤地点","退勤","退勤地点","休憩","労働時間","状態"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? "transparent" : COLORS.panel + "88" }}>
                  <td style={{ padding: "11px 16px", color: COLORS.textSub, whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                  <td style={{ padding: "11px 16px", color: COLORS.text, fontFamily: "monospace" }}>{r.check_in?.slice(0,5) || "--"}</td>
                  <td style={{ padding: "11px 16px" }}><GpsTag lat={r.check_in_lat} lng={r.check_in_lng} acc={r.check_in_acc} /></td>
                  <td style={{ padding: "11px 16px", color: COLORS.text, fontFamily: "monospace" }}>{r.check_out?.slice(0,5) || "--:--"}</td>
                  <td style={{ padding: "11px 16px" }}><GpsTag lat={r.check_out_lat} lng={r.check_out_lng} acc={r.check_out_acc} /></td>
                  <td style={{ padding: "11px 16px", color: COLORS.muted }}>{r.break_mins || 0}分</td>
                  <td style={{ padding: "11px 16px", color: COLORS.accent, fontWeight: 700, fontFamily: "monospace" }}>{r.work_mins ? hhmm(r.work_mins) : "--"}</td>
                  <td style={{ padding: "11px 16px" }}>
                    <Badge label={r.status} color={r.status === "出勤中" ? COLORS.green : r.status === "退勤済" ? COLORS.muted : COLORS.yellow} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: COLORS.muted }}>データがありません</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Leave View ────────────────────────────────────────────────────────────────
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

  const updateStatus = async (id, status) => { await api.updateLeaveStatus(id, status); await loadLeaves(); };
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ color: COLORS.text, margin: 0, fontSize: 16, fontWeight: 700 }}>{isAdmin ? "休暇申請一覧" : "マイ休暇申請"}</h3>
        {!isAdmin && (
          <button onClick={() => setShowForm(!showForm)} style={{
            background: COLORS.accentSoft, color: COLORS.accent, border: `1px solid ${COLORS.accent}44`,
            borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>＋ 新規申請</button>
        )}
      </div>

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ color: COLORS.textSub, fontSize: 12, display: "block", marginBottom: 4 }}>種別</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ width: "100%", background: COLORS.panel, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px" }}>
                {["有給休暇","特別休暇","慶弔休暇","病気休暇"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: COLORS.textSub, fontSize: 12, display: "block", marginBottom: 4 }}>開始日</label>
              <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}
                style={{ width: "100%", background: COLORS.panel, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px" }} />
            </div>
            <div>
              <label style={{ color: COLORS.textSub, fontSize: 12, display: "block", marginBottom: 4 }}>終了日</label>
              <input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}
                style={{ width: "100%", background: COLORS.panel, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px" }} />
            </div>
          </div>
          <button onClick={submit} disabled={submitting} style={{
            background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8,
            padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1,
          }}>{submitting ? "送信中…" : "申請する"}</button>
        </Card>
      )}

      {loading ? <Spinner /> : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: COLORS.panel }}>
                {[...(isAdmin ? ["氏名"] : []),"種別","期間","日数","状態",...(isAdmin ? ["操作"] : [])].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaves.map((l, i) => (
                <tr key={l.id} style={{ borderTop: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? "transparent" : COLORS.panel + "88" }}>
                  {isAdmin && <td style={{ padding: "11px 16px", color: COLORS.text }}>{empMap[l.employee_id]?.name || "—"}</td>}
                  <td style={{ padding: "11px 16px", color: COLORS.textSub }}>{l.type}</td>
                  <td style={{ padding: "11px 16px", color: COLORS.text, fontFamily: "monospace", fontSize: 12 }}>{l.from_date} → {l.to_date}</td>
                  <td style={{ padding: "11px 16px", color: COLORS.accent, fontWeight: 700 }}>{l.days}日</td>
                  <td style={{ padding: "11px 16px" }}>
                    <Badge label={l.status} color={l.status === "承認済" ? COLORS.green : l.status === "却下" ? COLORS.red : COLORS.yellow} />
                  </td>
                  {isAdmin && (
                    <td style={{ padding: "11px 16px" }}>
                      {l.status === "申請中" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => updateStatus(l.id, "承認済")} style={{ background: COLORS.greenSoft, color: COLORS.green, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>承認</button>
                          <button onClick={() => updateStatus(l.id, "却下")} style={{ background: COLORS.redSoft, color: COLORS.red, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>却下</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {leaves.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: COLORS.muted }}>申請がありません</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Dashboard View ────────────────────────────────────────────────────────────
function DashboardView({ employees }) {
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAllAttendance(), api.getAllLeaves()])
      .then(([a, l]) => { setAttendance(a); setLeaves(l); })
      .finally(() => setLoading(false));
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecs = attendance.filter((r) => r.date === todayStr);
  const checkedIn  = todayRecs.filter((r) => r.status === "出勤中").length;
  const checkedOut = todayRecs.filter((r) => r.status === "退勤済").length;
  const pending    = leaves.filter((l) => l.status === "申請中").length;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatBox label="本日出勤中" value={`${checkedIn}人`} accent={COLORS.green} sub={`全${employees.length}名`} />
        <StatBox label="退勤済み" value={`${checkedOut}人`} accent={COLORS.muted} />
        <StatBox label="休暇申請（未処理）" value={`${pending}件`} accent={COLORS.yellow} />
        <StatBox label="総従業員数" value={`${employees.length}名`} accent={COLORS.accent} />
      </div>
      {loading ? <Spinner /> : (
        <Card>
          <h3 style={{ color: COLORS.text, margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>従業員ステータス一覧</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["氏名","部署","本日","有給残","今月稼働"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: COLORS.muted, fontWeight: 600, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const rec = todayRecs.find((r) => r.employee_id === e.id);
                const monthWork = attendance.filter((r) => r.employee_id === e.id).reduce((s, r) => s + (r.work_mins || 0), 0);
                return (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                    <td style={{ padding: "12px 12px", color: COLORS.text, fontWeight: 600 }}>{e.name}</td>
                    <td style={{ padding: "12px 12px", color: COLORS.textSub }}>{e.dept}</td>
                    <td style={{ padding: "12px 12px" }}>
                      <Badge label={rec ? rec.status : "未出勤"}
                        color={rec?.status === "出勤中" ? COLORS.green : rec?.status === "退勤済" ? COLORS.muted : COLORS.yellow} />
                    </td>
                    <td style={{ padding: "12px 12px", color: COLORS.green, fontWeight: 700, fontFamily: "monospace" }}>{(e.paid_days||0)-(e.used_paid_days||0)}日</td>
                    <td style={{ padding: "12px 12px", color: COLORS.accent, fontFamily: "monospace" }}>{hhmm(monthWork)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [employees, setEmployees] = useState([]);
  const [currentEmpId, setCurrentEmpId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState("punch");
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    api.getEmployees()
      .then((emps) => { setEmployees(emps); setCurrentEmpId(emps[0]?.id || null); })
      .catch((e) => setDbError(e.message))
      .finally(() => setLoadingEmps(false));
  }, []);

  const currentEmp = employees.find((e) => e.id === currentEmpId);
  const tabs = isAdmin
    ? [{ id: "dashboard", label: "📊 ダッシュボード" }, { id: "history", label: "📋 勤怠一覧" }, { id: "leave", label: "📅 休暇申請" }]
    : [{ id: "punch", label: "⏱ 打刻" }, { id: "history", label: "📋 勤怠履歴" }, { id: "leave", label: "📅 休暇申請" }];

  useEffect(() => { setTab(isAdmin ? "dashboard" : "punch"); }, [isAdmin]);

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text, fontFamily: "'Inter','Noto Sans JP',sans-serif" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ background: COLORS.panel, borderBottom: `1px solid ${COLORS.border}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: COLORS.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⏰</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.5px" }}>KintaiOS</span>
          <span style={{ color: COLORS.muted, fontSize: 11, marginLeft: 4 }}>勤怠管理システム</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {!isAdmin && employees.length > 0 && (
            <select value={currentEmpId || ""} onChange={(e) => setCurrentEmpId(e.target.value)}
              style={{ background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 13 }}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
          <button onClick={() => setIsAdmin(!isAdmin)} style={{
            background: isAdmin ? COLORS.accentSoft : COLORS.card,
            color: isAdmin ? COLORS.accent : COLORS.textSub,
            border: `1px solid ${isAdmin ? COLORS.accent + "55" : COLORS.border}`,
            borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{isAdmin ? "👤 社員モード" : "🔑 管理者モード"}</button>
        </div>
      </div>

      <div style={{ background: COLORS.panel, borderBottom: `1px solid ${COLORS.border}`, padding: "0 32px", display: "flex" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none",
            borderBottom: tab === t.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
            color: tab === t.id ? COLORS.accent : COLORS.muted,
            padding: "14px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "32px 24px" }}>
        {dbError && (
          <div style={{ background: COLORS.redSoft, border: `1px solid ${COLORS.red}44`, borderRadius: 10, padding: "12px 20px", color: COLORS.red, marginBottom: 20, fontSize: 13 }}>
            ⚠ Supabase接続エラー: {dbError}
          </div>
        )}
        {loadingEmps ? <Spinner /> : currentEmp ? (
          <>
            {tab === "punch"     && <PunchView currentEmp={currentEmp} />}
            {tab === "history"   && <HistoryView currentEmp={currentEmp} employees={employees} isAdmin={isAdmin} />}
            {tab === "leave"     && <LeaveView currentEmp={currentEmp} employees={employees} isAdmin={isAdmin} />}
            {tab === "dashboard" && <DashboardView employees={employees} />}
          </>
        ) : (
          <div style={{ textAlign: "center", color: COLORS.muted, padding: 40 }}>従業員データが見つかりません</div>
        )}
      </div>
    </div>
  );
}
