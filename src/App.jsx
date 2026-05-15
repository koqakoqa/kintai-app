import { useState, useEffect } from "react";

const SUPABASE_URL = "https://ialulmvdzzgfucspwluf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbHVsbXZkenpnZnVjc3B3bHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODc3MDEsImV4cCI6MjA5NDM2MzcwMX0.wWX0GXlU5OoVg8lxNXRR_0lM63Z2APjKAhLzDG0xAXM";

const sb = async (path, opts) => {
  const options = opts || {};
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
    },
    method: options.method,
    body: options.body,
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const api = {
  getEmployees: function() { return sb("employees?select=*"); },
  getAttendance: function(empId) { return sb("attendance?employee_id=eq." + empId + "&select=*&order=date.desc&limit=30"); },
  getAllAttendance: function() { return sb("attendance?select=*&order=date.desc&limit=500"); },
  getLeaves: function(empId) { return sb("leave_requests?employee_id=eq." + empId + "&select=*&order=created_at.desc"); },
  getAllLeaves: function() { return sb("leave_requests?select=*&order=created_at.desc"); },
  checkIn: function(empId, time, loc) {
    return sb("attendance", {
      method: "POST",
      body: JSON.stringify({
        employee_id: empId,
        date: new Date().toISOString().slice(0, 10),
        check_in: time,
        check_in_lat: loc ? loc.lat : null,
        check_in_lng: loc ? loc.lng : null,
        check_in_acc: loc ? loc.acc : null,
        status: "出勤中",
      }),
    });
  },
  checkOut: function(id, time, workMins, loc) {
    return sb("attendance?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({
        check_out: time,
        check_out_lat: loc ? loc.lat : null,
        check_out_lng: loc ? loc.lng : null,
        check_out_acc: loc ? loc.acc : null,
        work_mins: workMins,
        status: "退勤済",
      }),
    });
  },
  updateBreak: function(id, breakMins) {
    return sb("attendance?id=eq." + id, { method: "PATCH", body: JSON.stringify({ break_mins: breakMins }) });
  },
  createLeave: function(data) { return sb("leave_requests", { method: "POST", body: JSON.stringify(data) }); },
  updateLeaveStatus: function(id, status) {
    return sb("leave_requests?id=eq." + id, { method: "PATCH", body: JSON.stringify({ status: status }) });
  },
  createEmployee: function(data) { return sb("employees", { method: "POST", body: JSON.stringify(data) }); },
  updateEmployee: function(id, data) { return sb("employees?id=eq." + id, { method: "PATCH", body: JSON.stringify(data) }); },
  deleteEmployee: function(id) { return sb("employees?id=eq." + id, { method: "DELETE", prefer: "return=minimal" }); },
};

const BG = "#0a0e1a";
const PANEL = "#0d1424";
const CARD = "#111c30";
const BORDER = "#1e2d4a";
const PRIMARY = "#1560bd";
const PRIMARYLT = "#1e7ae0";
const ACCENT = "#3b9eff";
const ACCENTSOFT = "#0a2040";
const GREEN = "#00c896";
const GREENSOFT = "#002a1f";
const RED = "#ff5252";
const REDSOFT = "#2a0a0a";
const YELLOW = "#ffb300";
const YELLOWSOFT = "#2a1a00";
const TEXT = "#e8edf5";
const TEXTSUB = "#8fa8c8";
const MUTED = "#4a6080";
const STEEL = "#4a7fa5";
const GRID = "#1a2840";

function nowStr() {
  return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(s) {
  return new Date(s).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
}
function hhmm(mins) {
  return Math.floor(mins / 60) + "h " + (mins % 60) + "m";
}

function getLocation() {
  return new Promise(function(resolve) {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      function(p) { resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); },
      function() { resolve(null); },
      { timeout: 8000, maximumAge: 0 }
    );
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lng + "&format=json&accept-language=ja",
      { headers: { "User-Agent": "SanoKogyo-Kintai/1.0" } }
    );
    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.county || "";
    const state = a.state || a.province || "";
    return city ? (state + " " + city).trim() : (state || "不明");
  } catch (e) {
    return null;
  }
}

function GpsTag(props) {
  const lat = props.lat;
  const lng = props.lng;
  const loading = props.loading;
  const [place, setPlace] = useState(null);
  useEffect(function() {
    if (lat && lng) { reverseGeocode(lat, lng).then(function(p) { setPlace(p); }); }
  }, [lat, lng]);
  if (loading) return <span style={{ color: YELLOW, fontSize: 11 }}>GPS取得中...</span>;
  if (!lat) return <span style={{ color: MUTED, fontSize: 11 }}>-</span>;
  return (
    <a href={"https://www.google.com/maps?q=" + lat + "," + lng} target="_blank" rel="noreferrer"
      style={{ color: ACCENT, fontSize: 11, textDecoration: "none" }}>
      [{place || "取得中..."}]
    </a>
  );
}

function Badge(props) {
  const color = props.color || ACCENT;
  return (
    <span style={{ background: color + "28", color: color, padding: "3px 12px", borderRadius: 4, fontSize: 12, fontWeight: 700, border: "1px solid " + color + "44" }}>
      {props.label}
    </span>
  );
}

function Card(props) {
  const style = Object.assign({ background: CARD, border: "1px solid " + BORDER, borderRadius: 8, padding: "20px 24px", position: "relative", overflow: "hidden" }, props.style || {});
  return (
    <div style={style}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + PRIMARY + ", " + ACCENT + ")" }} />
      {props.children}
    </div>
  );
}

function StatBox(props) {
  const accent = props.accent || ACCENT;
  return (
    <div style={{ background: CARD, border: "1px solid " + BORDER, borderRadius: 8, padding: "18px 20px", flex: 1, minWidth: 140, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + accent + "88, " + accent + ")" }} />
      <div style={{ color: TEXTSUB, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{props.label}</div>
      <div style={{ color: accent, fontSize: 26, fontWeight: 900, fontFamily: "monospace" }}>{props.value}</div>
      {props.sub && <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>{props.sub}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, flexDirection: "column", gap: 12 }}>
      <div style={{ width: 36, height: 36, border: "3px solid " + BORDER, borderTop: "3px solid " + ACCENT, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ color: MUTED, fontSize: 12 }}>読み込み中...</span>
    </div>
  );
}

function Input(props) {
  return (
    <input
      type={props.type || "text"}
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder || ""}
      style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }}
    />
  );
}

function LoginView(props) {
  const employees = props.employees;
  const onLogin = props.onLogin;
  const [selectedId, setSelectedId] = useState(employees.length > 0 ? employees[0].id : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const emp = employees.find(function(e) { return e.id === selectedId; });
    if (!emp) { setError("社員を選択してください"); setLoading(false); return; }
    if (emp.password !== password) { setError("パスワードが違います"); setLoading(false); return; }
    onLogin(emp);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 60, height: 60, background: "linear-gradient(135deg, " + PRIMARY + ", " + ACCENT + ")", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px", boxShadow: "0 8px 32px " + PRIMARY + "66" }}>🏗</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: TEXT, marginBottom: 4 }}>佐野工業株式会社</div>
          <div style={{ color: MUTED, fontSize: 13 }}>勤怠管理システム</div>
        </div>

        <Card>
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: TEXTSUB, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>社員を選択</label>
            <select value={selectedId} onChange={function(e) { setSelectedId(e.target.value); }}
              style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }}>
              {employees.map(function(e) { return <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>; })}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ color: TEXTSUB, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={function(e) { setPassword(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter") handleLogin(); }}
              placeholder="パスワードを入力"
              style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }}
            />
          </div>

          {error && (
            <div style={{ background: REDSOFT, border: "1px solid " + RED + "44", borderRadius: 8, padding: "10px 14px", color: RED, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading}
            style={{ width: "100%", background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, boxShadow: "0 4px 16px " + PRIMARY + "66" }}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </Card>
        <div style={{ textAlign: "center", marginTop: 16, color: MUTED, fontSize: 12 }}>初期パスワード: 0000</div>
      </div>
    </div>
  );
}

function PunchView(props) {
  const currentEmp = props.currentEmp;
  const [clock, setClock] = useState(new Date());
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [breakStart, setBreakStart] = useState(null);
  const [error, setError] = useState(null);

  useEffect(function() {
    const t = setInterval(function() { setClock(new Date()); }, 1000);
    return function() { clearInterval(t); };
  }, []);

  async function loadToday() {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const rows = await sb("attendance?employee_id=eq." + currentEmp.id + "&date=eq." + todayStr + "&select=*");
      setToday(rows[0] || null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  useEffect(function() { loadToday(); }, [currentEmp.id]);

  async function punch(type) {
    setError(null);
    try {
      if (type === "checkIn") {
        setGpsLoading(true);
        const loc = await getLocation();
        setGpsLoading(false);
        await api.checkIn(currentEmp.id, nowStr(), loc);
        await loadToday();
      } else if (type === "break") {
        setOnBreak(true);
        setBreakStart(new Date());
      } else if (type === "resume") {
        setOnBreak(false);
        const mins = Math.round((new Date() - breakStart) / 60000);
        await api.updateBreak(today.id, (today.break_mins || 0) + mins);
        await loadToday();
      } else if (type === "checkOut") {
        setGpsLoading(true);
        const loc = await getLocation();
        setGpsLoading(false);
        const parts = today.check_in.slice(0, 5).split(":");
        const inMins = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        const outMins = clock.getHours() * 60 + clock.getMinutes();
        const workMins = outMins - inMins - (today.break_mins || 0);
        await api.checkOut(today.id, nowStr(), workMins, loc);
        await loadToday();
      }
    } catch (e) { setError(e.message); setGpsLoading(false); }
  }

  const statusColor = today && today.status === "退勤済" ? MUTED : today && today.status === "出勤中" ? GREEN : YELLOW;

  function PBtn(p) {
    const dis = p.disabled || gpsLoading;
    return (
      <button onClick={p.onClick} disabled={dis}
        style={{ background: dis ? BORDER : p.bg, color: dis ? MUTED : p.color, border: "2px solid " + (dis ? BORDER : p.color), borderRadius: 10, padding: "16px 24px", fontWeight: 800, fontSize: 15, cursor: dis ? "not-allowed" : "pointer", opacity: dis ? 0.4 : 1, minWidth: 100 }}>
        {p.label}
      </button>
    );
  }

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #0d2a5c, #0a2040)", border: "1px solid " + BORDER, borderRadius: 12, padding: "32px 24px", textAlign: "center", marginBottom: 24 }}>
        <div style={{ color: TEXTSUB, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{fmtDate(clock)}</div>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: "-3px", color: TEXT, fontFamily: "monospace", lineHeight: 1, marginBottom: 8 }}>
          {clock.toLocaleTimeString("ja-JP")}
        </div>
        <div style={{ color: TEXTSUB, fontSize: 14 }}>{currentEmp.name} / {currentEmp.dept}</div>
        {today && <div style={{ marginTop: 12 }}><Badge label={today.status} color={statusColor} /></div>}
      </div>

      {loading ? <Spinner /> : (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>本日の勤務記録</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ textAlign: "center", background: PANEL, borderRadius: 8, padding: "12px 8px", border: "1px solid " + BORDER }}>
                <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>出勤</div>
                <div style={{ color: GREEN, fontWeight: 800, fontSize: 20, fontFamily: "monospace" }}>{today && today.check_in ? today.check_in.slice(0, 5) : "--:--"}</div>
              </div>
              <div style={{ textAlign: "center", background: PANEL, borderRadius: 8, padding: "12px 8px", border: "1px solid " + BORDER }}>
                <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>休憩</div>
                <div style={{ color: YELLOW, fontWeight: 800, fontSize: 20, fontFamily: "monospace" }}>{today ? (today.break_mins || 0) + "分" : "--"}</div>
              </div>
              <div style={{ textAlign: "center", background: PANEL, borderRadius: 8, padding: "12px 8px", border: "1px solid " + BORDER }}>
                <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>退勤</div>
                <div style={{ color: ACCENT, fontWeight: 800, fontSize: 20, fontFamily: "monospace" }}>{today && today.check_out ? today.check_out.slice(0, 5) : "--:--"}</div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid " + BORDER, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {today && today.check_in && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: MUTED, fontSize: 10, fontWeight: 700, minWidth: 40 }}>出勤</span>
                  <GpsTag lat={today.check_in_lat} lng={today.check_in_lng} loading={gpsLoading && !today.check_out} />
                </div>
              )}
              {today && today.check_out && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: MUTED, fontSize: 10, fontWeight: 700, minWidth: 40 }}>退勤</span>
                  <GpsTag lat={today.check_out_lat} lng={today.check_out_lng} loading={false} />
                </div>
              )}
              {!today && <span style={{ color: MUTED, fontSize: 11 }}>打刻時にGPS位置を自動記録します</span>}
            </div>
          </Card>

          {error && <div style={{ background: REDSOFT, border: "1px solid " + RED + "44", borderRadius: 8, padding: "10px 16px", color: RED, marginBottom: 16, fontSize: 13 }}>{error}</div>}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <PBtn label="出勤" color={GREEN} bg={GREENSOFT} onClick={function() { punch("checkIn"); }} disabled={!!today} />
            <PBtn label="休憩開始" color={YELLOW} bg={YELLOWSOFT} onClick={function() { punch("break"); }} disabled={!today || onBreak || !!(today && today.check_out)} />
            <PBtn label="休憩終了" color={ACCENT} bg={ACCENTSOFT} onClick={function() { punch("resume"); }} disabled={!onBreak} />
            <PBtn label="退勤" color={RED} bg={REDSOFT} onClick={function() { punch("checkOut"); }} disabled={!today || !!(today && today.check_out)} />
          </div>
          <div style={{ textAlign: "center", marginTop: 14, color: MUTED, fontSize: 11 }}>打刻時にGPS位置情報を自動記録します</div>
        </div>
      )}
    </div>
  );
}

function HistoryView(props) {
  const currentEmp = props.currentEmp;
  const employees = props.employees;
  const isAdmin = props.isAdmin;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEmpId, setFilterEmpId] = useState(currentEmp.id);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(function() {
    setLoading(true);
    api.getAttendance(isAdmin ? filterEmpId : currentEmp.id).then(function(data) {
      setRows(data);
      setLoading(false);
    });
  }, [filterEmpId, isAdmin]);

  const filtered = rows.filter(function(r) { return r.date && r.date.slice(0, 7) === month; });
  const totalWork = filtered.reduce(function(s, r) { return s + (r.work_mins || 0); }, 0);
  const avgWork = filtered.length ? Math.round(totalWork / filtered.length) : 0;

  function exportCSV() {
    const emp = isAdmin ? employees.find(function(e) { return e.id === filterEmpId; }) : currentEmp;
    const name = emp ? emp.name : "unknown";
    const headers = ["日付","出勤","退勤","休憩(分)","労働時間(分)","状態","出勤地点","退勤地点"];
    const csvRows = [headers.join(",")];
    filtered.forEach(function(r) {
      csvRows.push([
        r.date,
        r.check_in ? r.check_in.slice(0,5) : "",
        r.check_out ? r.check_out.slice(0,5) : "",
        r.break_mins || 0,
        r.work_mins || 0,
        r.status,
        (r.check_in_lat && r.check_in_lng) ? r.check_in_lat + "," + r.check_in_lng : "",
        (r.check_out_lat && r.check_out_lng) ? r.check_out_lat + "," + r.check_out_lng : "",
      ].join(","));
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name + "_" + month + "_勤怠.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="総労働時間" value={hhmm(totalWork)} accent={ACCENT} />
        <StatBox label="1日平均" value={hhmm(avgWork)} accent={GREEN} />
        <StatBox label="出勤日数" value={filtered.length + "日"} accent={YELLOW} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input type="month" value={month} onChange={function(e) { setMonth(e.target.value); }}
          style={{ background: CARD, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "8px 14px", fontSize: 14, outline: "none" }} />
        {isAdmin && (
          <select value={filterEmpId} onChange={function(e) { setFilterEmpId(e.target.value); }}
            style={{ background: CARD, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "8px 14px", fontSize: 14, outline: "none" }}>
            {employees.map(function(e) { return <option key={e.id} value={e.id}>{e.name}</option>; })}
          </select>
        )}
        <button onClick={exportCSV}
          style={{ background: GREENSOFT, color: GREEN, border: "1px solid " + GREEN + "44", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          CSV出力
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ background: CARD, border: "1px solid " + BORDER, borderRadius: 8, overflow: "auto", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + PRIMARY + ", " + ACCENT + ")" }} />
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: PANEL }}>
                {["日付","出勤","出勤地点","退勤","退勤地点","休憩","労働時間","状態"].map(function(h) {
                  return <th key={h} style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid " + BORDER }}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(r, i) {
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid " + GRID, background: i % 2 === 0 ? "transparent" : PANEL + "60" }}>
                    <td style={{ padding: "12px 16px", color: TEXTSUB, whiteSpace: "nowrap", fontWeight: 600 }}>{fmtDate(r.date)}</td>
                    <td style={{ padding: "12px 16px", color: GREEN, fontFamily: "monospace", fontWeight: 700 }}>{r.check_in ? r.check_in.slice(0, 5) : "--"}</td>
                    <td style={{ padding: "12px 16px" }}><GpsTag lat={r.check_in_lat} lng={r.check_in_lng} loading={false} /></td>
                    <td style={{ padding: "12px 16px", color: ACCENT, fontFamily: "monospace", fontWeight: 700 }}>{r.check_out ? r.check_out.slice(0, 5) : "--:--"}</td>
                    <td style={{ padding: "12px 16px" }}><GpsTag lat={r.check_out_lat} lng={r.check_out_lng} loading={false} /></td>
                    <td style={{ padding: "12px 16px", color: MUTED }}>{(r.break_mins || 0) + "分"}</td>
                    <td style={{ padding: "12px 16px", color: YELLOW, fontWeight: 800, fontFamily: "monospace" }}>{r.work_mins ? hhmm(r.work_mins) : "--"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <Badge label={r.status} color={r.status === "出勤中" ? GREEN : r.status === "退勤済" ? STEEL : YELLOW} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: MUTED }}>データがありません</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeaveView(props) {
  const currentEmp = props.currentEmp;
  const employees = props.employees;
  const isAdmin = props.isAdmin;
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [leaveType, setLeaveType] = useState("有給休暇");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadLeaves() {
    setLoading(true);
    const data = isAdmin ? await api.getAllLeaves() : await api.getLeaves(currentEmp.id);
    setLeaves(data);
    setLoading(false);
  }

  useEffect(function() { loadLeaves(); }, [isAdmin]);

  async function submit() {
    if (!leaveFrom || !leaveTo) return;
    setSubmitting(true);
    const days = Math.round((new Date(leaveTo) - new Date(leaveFrom)) / 86400000) + 1;
    await api.createLeave({ employee_id: currentEmp.id, type: leaveType, from_date: leaveFrom, to_date: leaveTo, days: days, status: "申請中" });
    setLeaveType("有給休暇");
    setLeaveFrom("");
    setLeaveTo("");
    setShowForm(false);
    setSubmitting(false);
    await loadLeaves();
  }

  async function updateStatus(id, status) {
    await api.updateLeaveStatus(id, status);
    await loadLeaves();
  }

  const empMap = {};
  employees.forEach(function(e) { empMap[e.id] = e; });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ color: TEXT, margin: 0, fontSize: 16, fontWeight: 800 }}>{isAdmin ? "休暇申請一覧" : "マイ休暇申請"}</h3>
        {!isAdmin && (
          <button onClick={function() { setShowForm(!showForm); }}
            style={{ background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            + 新規申請
          </button>
        )}
      </div>

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>種別</label>
              <select value={leaveType} onChange={function(e) { setLeaveType(e.target.value); }}
                style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }}>
                <option>有給休暇</option><option>特別休暇</option><option>慶弔休暇</option><option>病気休暇</option>
              </select>
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>開始日</label>
              <input type="date" value={leaveFrom} onChange={function(e) { setLeaveFrom(e.target.value); }}
                style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>終了日</label>
              <input type="date" value={leaveTo} onChange={function(e) { setLeaveTo(e.target.value); }}
                style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
          </div>
          <button onClick={submit} disabled={submitting}
            style={{ background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "送信中..." : "申請する"}
          </button>
        </Card>
      )}

      {loading ? <Spinner /> : (
        <div style={{ background: CARD, border: "1px solid " + BORDER, borderRadius: 8, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + PRIMARY + ", " + ACCENT + ")" }} />
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: PANEL }}>
                {isAdmin && <th style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>氏名</th>}
                <th style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>種別</th>
                <th style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>期間</th>
                <th style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>日数</th>
                <th style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>状態</th>
                {isAdmin && <th style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {leaves.map(function(l, i) {
                const emp = empMap[l.employee_id];
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid " + GRID, background: i % 2 === 0 ? "transparent" : PANEL + "60" }}>
                    {isAdmin && <td style={{ padding: "12px 16px", color: TEXT, fontWeight: 600 }}>{emp ? emp.name : "-"}</td>}
                    <td style={{ padding: "12px 16px", color: TEXTSUB }}>{l.type}</td>
                    <td style={{ padding: "12px 16px", color: TEXT, fontFamily: "monospace", fontSize: 12 }}>{l.from_date} - {l.to_date}</td>
                    <td style={{ padding: "12px 16px", color: ACCENT, fontWeight: 800 }}>{l.days}日</td>
                    <td style={{ padding: "12px 16px" }}><Badge label={l.status} color={l.status === "承認済" ? GREEN : l.status === "却下" ? RED : YELLOW} /></td>
                    {isAdmin && (
                      <td style={{ padding: "12px 16px" }}>
                        {l.status === "申請中" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={function() { updateStatus(l.id, "承認済"); }}
                              style={{ background: GREENSOFT, color: GREEN, border: "1px solid " + GREEN + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>承認</button>
                            <button onClick={function() { updateStatus(l.id, "却下"); }}
                              style={{ background: REDSOFT, color: RED, border: "1px solid " + RED + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>却下</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {leaves.length === 0 && <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: MUTED }}>申請がありません</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmployeeView(props) {
  const [employees, setEmployees] = useState(props.employees);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ name: "", dept: "", email: "", password: "0000", paid_days: 20, used_paid_days: 0, is_admin: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function reload() {
    const data = await api.getEmployees();
    setEmployees(data);
    props.onUpdate(data);
  }

  function openNew() {
    setEditTarget(null);
    setForm({ name: "", dept: "", email: "", password: "0000", paid_days: 20, used_paid_days: 0, is_admin: false });
    setShowForm(true);
    setError(null);
  }

  function openEdit(emp) {
    setEditTarget(emp);
    setForm({ name: emp.name, dept: emp.dept, email: emp.email || "", password: emp.password || "0000", paid_days: emp.paid_days || 20, used_paid_days: emp.used_paid_days || 0, is_admin: emp.is_admin || false });
    setShowForm(true);
    setError(null);
  }

  async function save() {
    if (!form.name || !form.dept) { setError("氏名と部署は必須です"); return; }
    setSaving(true);
    setError(null);
    try {
      if (editTarget) {
        await api.updateEmployee(editTarget.id, form);
      } else {
        await api.createEmployee(form);
      }
      setShowForm(false);
      await reload();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function deleteEmp(emp) {
    if (!window.confirm(emp.name + " を削除しますか？")) return;
    await api.deleteEmployee(emp.id);
    await reload();
  }

  function setF(key, val) { setForm(function(prev) { const next = {}; Object.keys(prev).forEach(function(k) { next[k] = prev[k]; }); next[key] = val; return next; }); }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ color: TEXT, margin: 0, fontSize: 16, fontWeight: 800 }}>従業員管理</h3>
        <button onClick={openNew}
          style={{ background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + 新規追加
        </button>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>
            {editTarget ? "従業員を編集" : "新規従業員を追加"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>氏名 *</label>
              <input value={form.name} onChange={function(e) { setF("name", e.target.value); }} placeholder="山田 太郎"
                style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>部署 *</label>
              <input value={form.dept} onChange={function(e) { setF("dept", e.target.value); }} placeholder="施工部"
                style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>メールアドレス</label>
              <input value={form.email} onChange={function(e) { setF("email", e.target.value); }} placeholder="yamada@example.com"
                style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>パスワード</label>
              <input value={form.password} onChange={function(e) { setF("password", e.target.value); }} placeholder="0000"
                style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>有給付与日数</label>
              <input type="number" value={form.paid_days} onChange={function(e) { setF("paid_days", parseInt(e.target.value)); }}
                style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>有給取得済日数</label>
              <input type="number" value={form.used_paid_days} onChange={function(e) { setF("used_paid_days", parseInt(e.target.value)); }}
                style={{ width: "100%", background: PANEL, color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: TEXTSUB, fontSize: 13 }}>
              <input type="checkbox" checked={form.is_admin} onChange={function(e) { setF("is_admin", e.target.checked); }} />
              管理者権限を付与
            </label>
          </div>
          {error && <div style={{ background: REDSOFT, border: "1px solid " + RED + "44", borderRadius: 8, padding: "10px 14px", color: RED, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} disabled={saving}
              style={{ background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={function() { setShowForm(false); }}
              style={{ background: PANEL, color: TEXTSUB, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              キャンセル
            </button>
          </div>
        </Card>
      )}

      <div style={{ background: CARD, border: "1px solid " + BORDER, borderRadius: 8, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + PRIMARY + ", " + ACCENT + ")" }} />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: PANEL }}>
              {["氏名","部署","有給残","権限","操作"].map(function(h) {
                return <th key={h} style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map(function(e, i) {
              return (
                <tr key={e.id} style={{ borderTop: "1px solid " + GRID, background: i % 2 === 0 ? "transparent" : PANEL + "60" }}>
                  <td style={{ padding: "13px 16px", color: TEXT, fontWeight: 700 }}>{e.name}</td>
                  <td style={{ padding: "13px 16px", color: TEXTSUB }}>{e.dept}</td>
                  <td style={{ padding: "13px 16px", color: GREEN, fontWeight: 800, fontFamily: "monospace" }}>{((e.paid_days || 0) - (e.used_paid_days || 0)) + "日"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <Badge label={e.is_admin ? "管理者" : "一般"} color={e.is_admin ? ACCENT : MUTED} />
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={function() { openEdit(e); }}
                        style={{ background: ACCENTSOFT, color: ACCENT, border: "1px solid " + ACCENT + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>編集</button>
                      <button onClick={function() { deleteEmp(e); }}
                        style={{ background: REDSOFT, color: RED, border: "1px solid " + RED + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>削除</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardView(props) {
  const employees = props.employees;
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    Promise.all([api.getAllAttendance(), api.getAllLeaves()]).then(function(results) {
      setAttendance(results[0]);
      setLeaves(results[1]);
      setLoading(false);
    });
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecs = attendance.filter(function(r) { return r.date === todayStr; });
  const checkedIn = todayRecs.filter(function(r) { return r.status === "出勤中"; }).length;
  const checkedOut = todayRecs.filter(function(r) { return r.status === "退勤済"; }).length;
  const pending = leaves.filter(function(l) { return l.status === "申請中"; }).length;

  function exportAllCSV() {
    const month = new Date().toISOString().slice(0, 7);
    const filtered = attendance.filter(function(r) { return r.date && r.date.slice(0, 7) === month; });
    const empMap = {};
    employees.forEach(function(e) { empMap[e.id] = e; });
    const headers = ["氏名","部署","日付","出勤","退勤","休憩(分)","労働時間(分)","状態"];
    const csvRows = [headers.join(",")];
    filtered.forEach(function(r) {
      const emp = empMap[r.employee_id];
      csvRows.push([
        emp ? emp.name : "",
        emp ? emp.dept : "",
        r.date,
        r.check_in ? r.check_in.slice(0,5) : "",
        r.check_out ? r.check_out.slice(0,5) : "",
        r.break_mins || 0,
        r.work_mins || 0,
        r.status,
      ].join(","));
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = month + "_全社員勤怠.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatBox label="本日出勤中" value={checkedIn + "人"} accent={GREEN} sub={"全" + employees.length + "名"} />
        <StatBox label="退勤済み" value={checkedOut + "人"} accent={STEEL} />
        <StatBox label="未処理の休暇申請" value={pending + "件"} accent={YELLOW} />
        <StatBox label="総従業員数" value={employees.length + "名"} accent={ACCENT} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={exportAllCSV}
          style={{ background: GREENSOFT, color: GREEN, border: "1px solid " + GREEN + "44", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          今月の全社員CSV出力
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ background: CARD, border: "1px solid " + BORDER, borderRadius: 8, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + PRIMARY + ", " + ACCENT + ")" }} />
          <div style={{ padding: "16px 20px", borderBottom: "1px solid " + BORDER }}>
            <span style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>従業員ステータス一覧</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: PANEL }}>
                {["氏名","部署","本日の状況","有給残日数","今月の稼働時間"].map(function(h) {
                  return <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>{h}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map(function(e, i) {
                const rec = todayRecs.find(function(r) { return r.employee_id === e.id; });
                const monthWork = attendance.filter(function(r) { return r.employee_id === e.id && r.date && r.date.slice(0, 7) === new Date().toISOString().slice(0, 7); }).reduce(function(s, r) { return s + (r.work_mins || 0); }, 0);
                const recStatus = rec ? rec.status : "未出勤";
                const recColor = rec && rec.status === "出勤中" ? GREEN : rec && rec.status === "退勤済" ? STEEL : YELLOW;
                return (
                  <tr key={e.id} style={{ borderTop: "1px solid " + GRID, background: i % 2 === 0 ? "transparent" : PANEL + "60" }}>
                    <td style={{ padding: "13px 16px", color: TEXT, fontWeight: 700 }}>{e.name}</td>
                    <td style={{ padding: "13px 16px", color: TEXTSUB }}>{e.dept}</td>
                    <td style={{ padding: "13px 16px" }}><Badge label={recStatus} color={recColor} /></td>
                    <td style={{ padding: "13px 16px", color: GREEN, fontWeight: 800, fontFamily: "monospace" }}>{((e.paid_days || 0) - (e.used_paid_days || 0)) + "日"}</td>
                    <td style={{ padding: "13px 16px", color: ACCENT, fontFamily: "monospace", fontWeight: 700 }}>{hhmm(monthWork)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [loggedInEmp, setLoggedInEmp] = useState(null);
  const [tab, setTab] = useState("punch");
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [dbError, setDbError] = useState(null);

  useEffect(function() {
    api.getEmployees()
      .then(function(emps) { setEmployees(emps); })
      .catch(function(e) { setDbError(e.message); })
      .finally(function() { setLoadingEmps(false); });
  }, []);

  function handleLogin(emp) {
    setLoggedInEmp(emp);
    setTab(emp.is_admin ? "dashboard" : "punch");
  }

  function handleLogout() {
    setLoggedInEmp(null);
  }

  const isAdmin = loggedInEmp && loggedInEmp.is_admin;

  const tabs = isAdmin
    ? [{ id: "dashboard", text: "ダッシュボード" }, { id: "history", text: "勤怠一覧" }, { id: "leave", text: "休暇申請" }, { id: "employees", text: "従業員管理" }]
    : [{ id: "punch", text: "打刻" }, { id: "history", text: "勤怠履歴" }, { id: "leave", text: "休暇申請" }];

  if (loadingEmps) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
        <Spinner />
      </div>
    );
  }

  if (dbError) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: RED, fontSize: 14, padding: 24 }}>
        <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
        Supabase接続エラー: {dbError}
      </div>
    );
  }

  if (!loggedInEmp) {
    return (
      <div>
        <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} *{box-sizing:border-box}"}</style>
        <LoginView employees={employees} onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: "'Inter','Noto Sans JP',sans-serif" }}>
      <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} *{box-sizing:border-box}"}</style>

      <div style={{ background: PANEL, borderBottom: "1px solid " + BORDER, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg, " + PRIMARY + ", " + ACCENT + ")", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏗</div>
          <span style={{ fontWeight: 800, fontSize: 15, color: TEXT }}>佐野工業</span>
          <span style={{ color: MUTED, fontSize: 11 }}>勤怠管理システム</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: TEXTSUB, fontSize: 13 }}>
            {loggedInEmp.name}
            {isAdmin && <Badge label="管理者" color={ACCENT} />}
          </span>
          <button onClick={handleLogout}
            style={{ background: PANEL, color: TEXTSUB, border: "1px solid " + BORDER, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ログアウト
          </button>
        </div>
      </div>

      <div style={{ background: PANEL, borderBottom: "1px solid " + BORDER, padding: "0 28px", display: "flex" }}>
        {tabs.map(function(t) {
          return (
            <button key={t.id} onClick={function() { setTab(t.id); }}
              style={{ background: "none", border: "none", borderBottom: tab === t.id ? "3px solid " + ACCENT : "3px solid transparent", color: tab === t.id ? ACCENT : MUTED, padding: "14px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t.text}
            </button>
          );
        })}
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px" }}>
        {tab === "punch"     && <PunchView currentEmp={loggedInEmp} />}
        {tab === "history"   && <HistoryView currentEmp={loggedInEmp} employees={employees} isAdmin={isAdmin} />}
        {tab === "leave"     && <LeaveView currentEmp={loggedInEmp} employees={employees} isAdmin={isAdmin} />}
        {tab === "dashboard" && <DashboardView employees={employees} />}
        {tab === "employees" && <EmployeeView employees={employees} onUpdate={function(emps) { setEmployees(emps); }} />}
      </div>
    </div>
  );
}
