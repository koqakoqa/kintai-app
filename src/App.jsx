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
  getAttendance: function(empId) { return sb("attendance?employee_id=eq." + empId + "&select=*,sites(id,name,client)&order=date.desc&limit=60"); },
  getAllAttendance: function() { return sb("attendance?select=*,sites(id,name,client)&order=date.desc&limit=1000"); },
  getLeaves: function(empId) { return sb("leave_requests?employee_id=eq." + empId + "&select=*&order=created_at.desc"); },
  getAllLeaves: function() { return sb("leave_requests?select=*&order=created_at.desc"); },
  checkIn: function(empId, time, loc, siteId) {
    return sb("attendance", { method: "POST", body: JSON.stringify({
      employee_id: empId, date: new Date().toISOString().slice(0, 10),
      check_in: time, check_in_lat: loc ? loc.lat : null, check_in_lng: loc ? loc.lng : null, check_in_acc: loc ? loc.acc : null, status: "出勤中",
      site_id: siteId || null,
    })});
  },
  checkOut: function(id, time, workMins, loc) {
    return sb("attendance?id=eq." + id, { method: "PATCH", body: JSON.stringify({
      check_out: time, check_out_lat: loc ? loc.lat : null, check_out_lng: loc ? loc.lng : null, check_out_acc: loc ? loc.acc : null, work_mins: workMins, status: "退勤済",
    })});
  },
  updateBreak: function(id, breakMins) { return sb("attendance?id=eq." + id, { method: "PATCH", body: JSON.stringify({ break_mins: breakMins }) }); },
  upsertAttendance: function(empId, date, data) {
    return sb("attendance", { method: "POST", prefer: "resolution=merge-duplicates,return=representation",
      body: JSON.stringify(Object.assign({ employee_id: empId, date: date }, data)) });
  },
  deleteAttendance: function(id) { return sb("attendance?id=eq." + id, { method: "DELETE", prefer: "return=minimal" }); },
  createLeave: function(data) { return sb("leave_requests", { method: "POST", body: JSON.stringify(data) }); },
  updateLeaveStatus: function(id, status) { return sb("leave_requests?id=eq." + id, { method: "PATCH", body: JSON.stringify({ status: status }) }); },
  createEmployee: function(data) { return sb("employees", { method: "POST", body: JSON.stringify(data) }); },
  getSites: function() { return sb("sites?select=*&order=name"); },
  createSite: function(data) { return sb("sites", { method: "POST", body: JSON.stringify(data) }); },
  updateSite: function(id, data) { return sb("sites?id=eq." + id, { method: "PATCH", body: JSON.stringify(data) }); },
  deleteSite: function(id) { return sb("sites?id=eq." + id, { method: "DELETE", prefer: "return=minimal" }); },
  updateEmployee: function(id, data) { return sb("employees?id=eq." + id, { method: "PATCH", body: JSON.stringify(data) }); },
  deleteEmployee: function(id) { return sb("employees?id=eq." + id, { method: "DELETE", prefer: "return=minimal" }); },
};

const BG = "#f5f7fa"; const PANEL = "#ffffff"; const CARD = "#ffffff"; const BORDER = "#dde3ed";
const PRIMARY = "#1560bd"; const PRIMARYLT = "#1e7ae0"; const ACCENT = "#1e7ae0"; const ACCENTSOFT = "#e8f1fd";
const GREEN = "#059669"; const GREENSOFT = "#d1fae5"; const RED = "#dc2626"; const REDSOFT = "#fee2e2";
const YELLOW = "#d97706"; const YELLOWSOFT = "#fef3c7"; const TEXT = "#1e293b"; const TEXTSUB = "#475569";
const MUTED = "#94a3b8"; const STEEL = "#475569"; const GRID = "#e8edf5";

function nowStr() { return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(s) { return new Date(s).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" }); }
function hhmm(mins) { return Math.floor(mins / 60) + "時間" + (mins % 60) + "分"; }
function calcAutoBreak(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const ip = checkIn.slice(0,5).split(":"); const op = checkOut.slice(0,5).split(":");
  const inMins = parseInt(ip[0])*60 + parseInt(ip[1]);
  const outMins = parseInt(op[0])*60 + parseInt(op[1]);
  const breaks = [
    { start: 10*60, end: 10*60+30 },
    { start: 12*60, end: 13*60 },
    { start: 15*60, end: 15*60+30 },
  ];
  var total = 0;
  breaks.forEach(function(b) {
    const s = Math.max(b.start, inMins);
    const e = Math.min(b.end, outMins);
    if (e > s) total += (e - s);
  });
  return total;
}

function calcWorkMins(checkIn, checkOut, breakMins) {
  if (!checkIn || !checkOut) return 0;
  const ip = checkIn.slice(0,5).split(":"); const op = checkOut.slice(0,5).split(":");
  const result = (parseInt(op[0])*60+parseInt(op[1])) - (parseInt(ip[0])*60+parseInt(ip[1])) - (breakMins||0);
  return result > 0 ? result : 0;
}

function getLocation() {
  return new Promise(function(resolve) {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      function(p) { resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); },
      function() { resolve(null); }, { timeout: 8000, maximumAge: 0 }
    );
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch("https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lng + "&format=json&accept-language=ja", { headers: { "User-Agent": "SanoKogyo-Kintai/1.0" } });
    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.county || "";
    const state = a.state || a.province || "";
    return city ? (state + " " + city).trim() : (state || "不明");
  } catch (e) { return null; }
}

function GpsTag(props) {
  const [place, setPlace] = useState(null);
  useEffect(function() { if (props.lat && props.lng) { reverseGeocode(props.lat, props.lng).then(function(p) { setPlace(p); }); } }, [props.lat, props.lng]);
  if (props.loading) return <span style={{ color: YELLOW, fontSize: 11 }}>GPS取得中...</span>;
  if (!props.lat) return <span style={{ color: MUTED, fontSize: 11 }}>-</span>;
  return <a href={"https://www.google.com/maps?q=" + props.lat + "," + props.lng} target="_blank" rel="noreferrer" style={{ color: ACCENT, fontSize: 11, textDecoration: "none" }}>[{place || "取得中..."}]</a>;
}

function Badge(props) {
  const color = props.color || ACCENT;
  return <span style={{ background: color + "28", color: color, padding: "3px 12px", borderRadius: 4, fontSize: 12, fontWeight: 700, border: "1px solid " + color + "44" }}>{props.label}</span>;
}

function Card(props) {
  return (
    <div style={Object.assign({ background: CARD, border: "1px solid " + BORDER, borderRadius: 8, padding: "20px 24px", position: "relative", overflow: "hidden" }, props.style || {})}>
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

function FInput(props) {
  return (
    <input type={props.type || "text"} value={props.value} onChange={props.onChange} placeholder={props.placeholder || ""}
      style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }} />
  );
}

function Modal(props) {
  if (!props.open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,41,59,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: CARD, border: "1px solid " + BORDER, borderRadius: 12, padding: 28, width: "100%", maxWidth: 500, position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "12px 12px 0 0", background: "linear-gradient(90deg, " + PRIMARY + ", " + ACCENT + ")" }} />
        <div style={{ fontWeight: 800, fontSize: 16, color: TEXT, marginBottom: 20 }}>{props.title}</div>
        {props.children}
      </div>
    </div>
  );
}

//  ログイン 
function LoginView(props) {
  const employees = props.employees;
  const [selectedId, setSelectedId] = useState(employees.length > 0 ? employees[0].id : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null); setLoading(true);
    const emp = employees.find(function(e) { return e.id === selectedId; });
    if (!emp) { setError("社員を選択してください"); setLoading(false); return; }
    if (emp.password !== password) { setError("パスワードが違います"); setLoading(false); return; }
    props.onLogin(emp);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, " + PRIMARY + ", " + ACCENT + ")", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 16px", boxShadow: "0 8px 24px " + PRIMARY + "44" }}>🏗</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: TEXT, marginBottom: 4 }}>佐野工業株式会社</div>
          <div style={{ color: MUTED, fontSize: 13 }}>勤怠管理システム</div>
        </div>
        <Card>
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: TEXTSUB, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>社員を選択</label>
            <select value={selectedId} onChange={function(e) { setSelectedId(e.target.value); }}
              style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }}>
              {employees.map(function(e) { return <option key={e.id} value={e.id}>{e.name}</option>; })}
            </select>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: TEXTSUB, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>パスワード</label>
            <input type="password" value={password} onChange={function(e) { setPassword(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") handleLogin(); }} placeholder="パスワードを入力"
              style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }} />
          </div>
          {error && <div style={{ background: REDSOFT, border: "1px solid " + RED + "44", borderRadius: 8, padding: "10px 14px", color: RED, fontSize: 13, marginBottom: 16 }}>{error}</div>}
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

//  打刻 
function PunchView(props) {
  const currentEmp = props.currentEmp;
  const [clock, setClock] = useState(new Date());
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [breakStart, setBreakStart] = useState(null);
  const [error, setError] = useState(null);
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");

  useEffect(function() { const t = setInterval(function() { setClock(new Date()); }, 1000); return function() { clearInterval(t); }; }, []);

  useEffect(function() {
    api.getSites().then(function(data) { setSites(data); });
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
        setGpsLoading(true); const loc = await getLocation(); setGpsLoading(false);
        await api.checkIn(currentEmp.id, nowStr(), loc, selectedSiteId || null); await loadToday();
      } else if (type === "break") {
        setOnBreak(true); setBreakStart(new Date());
      } else if (type === "resume") {
        setOnBreak(false);
        const mins = Math.round((new Date() - breakStart) / 60000);
        await api.updateBreak(today.id, (today.break_mins || 0) + mins); await loadToday();
      } else if (type === "checkOut") {
        setGpsLoading(true); const loc = await getLocation(); setGpsLoading(false);
        const autoBreak = calcAutoBreak(today.check_in ? today.check_in.slice(0,5) : "", nowStr());
        const workMins = calcWorkMins(today.check_in, nowStr(), autoBreak);
        await api.updateBreak(today.id, autoBreak);
        await api.checkOut(today.id, nowStr(), workMins, loc); await loadToday();
      }
    } catch (e) { setError(e.message); setGpsLoading(false); }
  }

  const statusColor = today && today.status === "退勤済" ? MUTED : today && today.status === "出勤中" ? GREEN : YELLOW;

  function PBtn(p) {
    const dis = p.disabled || gpsLoading;
    const [anim, setAnim] = useState(false);

    function handleClick() {
      if (dis) return;
      setAnim(true);
      setTimeout(function() { setAnim(false); }, 500);
      p.onClick();
    }

    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        <button onClick={handleClick} disabled={dis} className="punch-btn"
          style={{
            background: dis ? "#e2e8f0" : p.bg,
            color: dis ? MUTED : p.color,
            border: "2px solid " + (dis ? "#e2e8f0" : p.color),
            borderRadius: 14,
            padding: "20px 36px",
            fontWeight: 900,
            fontSize: 18,
            cursor: dis ? "not-allowed" : "pointer",
            opacity: dis ? 0.5 : 1,
            minWidth: 130,
            boxShadow: dis ? "none" : "0 4px 16px " + p.color + "44",
            animation: anim ? "pulse 0.5s ease" : "none",
            position: "relative",
            overflow: "hidden",
            letterSpacing: "0.02em",
          }}>
          {p.label}
        </button>
        {anim && !dis && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 60, height: 60,
            marginTop: -30, marginLeft: -30,
            background: p.color,
            borderRadius: "50%",
            animation: "ripple 0.5s ease-out forwards",
            pointerEvents: "none",
          }} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #1560bd, #1e7ae0)", border: "1px solid " + BORDER, borderRadius: 12, padding: "32px 24px", textAlign: "center", marginBottom: 24 }}>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{fmtDate(clock)}</div>
        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: "-3px", color: "#ffffff", fontFamily: "monospace", lineHeight: 1, marginBottom: 8 }}>{clock.toLocaleTimeString("ja-JP")}</div>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>{currentEmp.name}</div>
        {today && <div style={{ marginTop: 12 }}><span style={{ background: "rgba(255,255,255,0.25)", color: "#ffffff", padding: "4px 16px", borderRadius: 99, fontSize: 13, fontWeight: 700, border: "1px solid rgba(255,255,255,0.4)" }}>{today.status}</span></div>}
      </div>
      {loading ? <Spinner /> : (
        <div>
          {!today && sites.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: TEXTSUB, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 8 }}>現場を選択</label>
              <select value={selectedSiteId} onChange={function(e) { setSelectedSiteId(e.target.value); }}
                style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none" }}>
                <option value="">現場を選択してください</option>
                {sites.map(function(s) { return <option key={s.id} value={s.id}>{s.name}{s.client ? " (" + s.client + ")" : ""}</option>; })}
              </select>
            </div>
          )}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>本日の勤務記録</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {[{ label: "出勤", val: today && today.check_in ? today.check_in.slice(0,5) : "--:--", color: GREEN },
                { label: "退勤", val: today && today.check_out ? today.check_out.slice(0,5) : "--:--", color: ACCENT }
              ].map(function(item) {
                return (
                  <div key={item.label} style={{ textAlign: "center", background: PANEL, borderRadius: 8, padding: "12px 8px", border: "1px solid " + BORDER }}>
                    <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ color: item.color, fontWeight: 800, fontSize: 20, fontFamily: "monospace" }}>{item.val}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: "1px solid " + BORDER, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {today && today.sites && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: MUTED, fontSize: 10, fontWeight: 700, minWidth: 40 }}>現場</span>
                  <span style={{ color: PRIMARY, fontSize: 12, fontWeight: 700 }}>{today.sites.name}{today.sites.client ? " (" + today.sites.client + ")" : ""}</span>
                </div>
              )}
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
          <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
            <PBtn label="出勤" color={GREEN} bg={GREENSOFT} onClick={function() { punch("checkIn"); }} disabled={!!today} />
            <PBtn label="退勤" color={RED} bg={REDSOFT} onClick={function() { punch("checkOut"); }} disabled={!today || !!(today && today.check_out)} />
          </div>
          <div style={{ textAlign: "center", marginTop: 14, color: MUTED, fontSize: 11 }}>打刻時にGPS位置情報を自動記録します</div>
        </div>
      )}
    </div>
  );
}

//  勤怠編集モーダル 
function AttendanceEditModal(props) {
  const rec = props.rec;
  const empId = props.empId;
  const onClose = props.onClose;
  const onSaved = props.onSaved;
  const dateEditable = props.dateEditable || false;
  const sites = props.sites || [];

  const [editDate, setEditDate] = useState(props.date);
  const [siteId, setSiteId] = useState(rec && rec.site_id ? rec.site_id : "");
  const [checkIn, setCheckIn] = useState(rec ? (rec.check_in ? rec.check_in.slice(0,5) : "") : "");
  const [checkOut, setCheckOut] = useState(rec ? (rec.check_out ? rec.check_out.slice(0,5) : "") : "");
  const initBreak = rec ? calcAutoBreak(rec.check_in ? rec.check_in.slice(0,5) : "", rec.check_out ? rec.check_out.slice(0,5) : "") : 0;
  const [breakMins, setBreakMins] = useState(initBreak);

  function handleCheckInChange(val) { setCheckIn(val); setBreakMins(calcAutoBreak(val, checkOut)); }
  function handleCheckOutChange(val) { setCheckOut(val); setBreakMins(calcAutoBreak(checkIn, val)); }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setError(null); setSaving(true);
    try {
      const wm = calcWorkMins(checkIn, checkOut, breakMins);
      const status = checkOut ? "退勤済" : checkIn ? "出勤中" : "未出勤";
      const data = { check_in: checkIn || null, check_out: checkOut || null, break_mins: breakMins, work_mins: wm, status: status, site_id: siteId || null };
      await api.upsertAttendance(empId, editDate, data);
      onSaved();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function deleteRec() {
    if (!rec || !window.confirm("この記録を削除しますか？")) return;
    setDeleting(true);
    try { await api.deleteAttendance(rec.id); onSaved(); } catch (e) { setError(e.message); }
    setDeleting(false);
  }

  const wm = calcWorkMins(checkIn, checkOut, breakMins);

  return (
    <Modal open={true} title={(rec ? "勤怠を編集" : "勤怠を追加")}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        {dateEditable && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>日付</label>
            <input type="date" value={editDate} onChange={function(e) { setEditDate(e.target.value); }}
              style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 14, outline: "none" }} />
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>現場</label>
          <select value={siteId} onChange={function(e) { setSiteId(e.target.value); }}
            style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }}>
            <option value="">現場未選択</option>
            {sites.map(function(s) { return <option key={s.id} value={s.id}>{s.name}{s.client ? " (" + s.client + ")" : ""}</option>; })}
          </select>
        </div>
        <div>
          <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>出勤時刻</label>
          <input type="time" value={checkIn} onChange={function(e) { handleCheckInChange(e.target.value); }}
            style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 14, outline: "none" }} />
        </div>
        <div>
          <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>退勤時刻</label>
          <input type="time" value={checkOut} onChange={function(e) { handleCheckOutChange(e.target.value); }}
            style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 14, outline: "none" }} />
        </div>
        <div>
          <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>休憩時間(分) <span style={{ color: MUTED, fontWeight: 400, fontSize: 10 }}>出退勤から自動計算</span></label>
          <input type="number" value={breakMins} onChange={function(e) { setBreakMins(parseInt(e.target.value)||0); }}
            style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 14, outline: "none" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 4 }}>
          <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>計算後の労働時間</div>
          <div style={{ color: wm > 0 ? YELLOW : MUTED, fontWeight: 800, fontSize: 18, fontFamily: "monospace" }}>{wm > 0 ? hhmm(wm) : "--"}</div>
        </div>
      </div>
      {error && <div style={{ background: REDSOFT, border: "1px solid " + RED + "44", borderRadius: 8, padding: "10px 14px", color: RED, fontSize: 13, marginBottom: 14 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={save} disabled={saving}
          style={{ background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "保存中..." : "保存"}
        </button>
        {rec && (
          <button onClick={deleteRec} disabled={deleting}
            style={{ background: REDSOFT, color: RED, border: "1px solid " + RED + "44", borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: deleting ? "not-allowed" : "pointer" }}>
            削除
          </button>
        )}
        <button onClick={onClose}
          style={{ background: "#f0f4f8", color: TEXTSUB, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          キャンセル
        </button>
      </div>
    </Modal>
  );
}

//  勤怠履歴 
function HistoryView(props) {
  const currentEmp = props.currentEmp;
  const employees = props.employees;
  const isAdmin = props.isAdmin;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEmpId, setFilterEmpId] = useState(currentEmp.id);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editModal, setEditModal] = useState(null);
  const [sites, setSites] = useState([]);

  useEffect(function() { api.getSites().then(setSites); }, []);

  async function loadRows() {
    setLoading(true);
    const data = await api.getAttendance(isAdmin ? filterEmpId : currentEmp.id);
    setRows(data); setLoading(false);
  }

  useEffect(function() { loadRows(); }, [filterEmpId, isAdmin]);

  const filtered = rows.filter(function(r) { return r.date && r.date.slice(0, 7) === month; });
  const totalWork = filtered.reduce(function(s, r) { return s + (r.work_mins || 0); }, 0);
  const avgWork = filtered.length ? Math.round(totalWork / filtered.length) : 0;

  function openEdit(r) { setEditModal({ rec: r, empId: isAdmin ? filterEmpId : currentEmp.id, date: r.date }); }
  function openAdd() {
    const d = month + "-" + String(new Date().getDate()).padStart(2,"0");
    setEditModal({ rec: null, empId: isAdmin ? filterEmpId : currentEmp.id, date: d, dateEditable: true });
  }

  function exportCSV() {
    const emp = isAdmin ? employees.find(function(e) { return e.id === filterEmpId; }) : currentEmp;
    const name = emp ? emp.name : "unknown";
    const csvRows = [["日付","出勤","退勤","休憩(分)","労働時間(分)","状態"].join(",")];
    filtered.forEach(function(r) {
      csvRows.push([r.date, r.check_in ? r.check_in.slice(0,5) : "", r.check_out ? r.check_out.slice(0,5) : "", r.break_mins||0, r.work_mins||0, r.status].join(","));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name + "_" + month + "_勤怠.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {editModal && (
        <AttendanceEditModal rec={editModal.rec} empId={editModal.empId} date={editModal.date} dateEditable={editModal.dateEditable || false} sites={sites}
          onClose={function() { setEditModal(null); }}
          onSaved={function() { setEditModal(null); loadRows(); }} />
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="総労働時間" value={hhmm(totalWork)} accent={ACCENT} />
        <StatBox label="1日平均" value={hhmm(avgWork)} accent={GREEN} />
        <StatBox label="出勤日数" value={filtered.length + "日"} accent={YELLOW} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input type="month" value={month} onChange={function(e) { setMonth(e.target.value); }}
          style={{ background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "8px 14px", fontSize: 14, outline: "none" }} />
        {isAdmin && (
          <select value={filterEmpId} onChange={function(e) { setFilterEmpId(e.target.value); }}
            style={{ background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "8px 14px", fontSize: 14, outline: "none" }}>
            {employees.map(function(e) { return <option key={e.id} value={e.id}>{e.name}</option>; })}
          </select>
        )}
        <button onClick={openAdd}
          style={{ background: ACCENTSOFT, color: ACCENT, border: "1px solid " + ACCENT + "44", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + 手動追加
        </button>
        <button onClick={exportCSV}
          style={{ background: GREENSOFT, color: GREEN, border: "1px solid " + GREEN + "44", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          CSV出力
        </button>
      </div>
      {loading ? <Spinner /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(function(r) {
            const statusColor = r.status === "出勤中" ? GREEN : r.status === "退勤済" ? STEEL : YELLOW;
            return (
              <div key={r.id} style={{ background: CARD, border: "1px solid " + BORDER, borderRadius: 10, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + statusColor + "88, " + statusColor + ")" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>{fmtDate(r.date)}</div>
                    {r.sites && <div style={{ color: PRIMARY, fontSize: 11, fontWeight: 600, marginTop: 2 }}>{r.sites.name}{r.sites.client ? " (" + r.sites.client + ")" : ""}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge label={r.status} color={statusColor} />
                    <button onClick={function() { openEdit(r); }}
                      style={{ background: ACCENTSOFT, color: ACCENT, border: "1px solid " + ACCENT + "44", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                      編集
                    </button>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>出勤</div>
                    <div style={{ color: GREEN, fontWeight: 800, fontSize: 16, fontFamily: "monospace" }}>{r.check_in ? r.check_in.slice(0,5) : "--:--"}</div>
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>退勤</div>
                    <div style={{ color: ACCENT, fontWeight: 800, fontSize: 16, fontFamily: "monospace" }}>{r.check_out ? r.check_out.slice(0,5) : "--:--"}</div>
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ color: MUTED, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>労働時間</div>
                    <div style={{ color: YELLOW, fontWeight: 800, fontSize: 16, fontFamily: "monospace" }}>{r.work_mins ? hhmm(r.work_mins) : "--"}</div>
                  </div>
                </div>
                {(r.check_in_lat || r.check_out_lat) && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {r.check_in_lat && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: MUTED, fontSize: 10, fontWeight: 700, minWidth: 36 }}>出勤</span>
                        <GpsTag lat={r.check_in_lat} lng={r.check_in_lng} loading={false} />
                      </div>
                    )}
                    {r.check_out_lat && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: MUTED, fontSize: 10, fontWeight: 700, minWidth: 36 }}>退勤</span>
                        <GpsTag lat={r.check_out_lat} lng={r.check_out_lng} loading={false} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", color: MUTED, padding: 40 }}>データがありません</div>
          )}
        </div>
      )}
    </div>
  );
}

//  休暇申請 
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
    setLeaves(data); setLoading(false);
  }

  useEffect(function() { loadLeaves(); }, [isAdmin]);

  async function submit() {
    if (!leaveFrom || !leaveTo) return;
    setSubmitting(true);
    const days = Math.round((new Date(leaveTo) - new Date(leaveFrom)) / 86400000) + 1;
    await api.createLeave({ employee_id: currentEmp.id, type: leaveType, from_date: leaveFrom, to_date: leaveTo, days: days, status: "申請中" });
    setLeaveType("有給休暇"); setLeaveFrom(""); setLeaveTo(""); setShowForm(false); setSubmitting(false);
    await loadLeaves();
  }

  async function updateStatus(id, status) { await api.updateLeaveStatus(id, status); await loadLeaves(); }

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
                style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }}>
                <option>有給休暇</option><option>特別休暇</option><option>慶弔休暇</option><option>病気休暇</option>
              </select>
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>開始日</label>
              <input type="date" value={leaveFrom} onChange={function(e) { setLeaveFrom(e.target.value); }}
                style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>終了日</label>
              <input type="date" value={leaveTo} onChange={function(e) { setLeaveTo(e.target.value); }}
                style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
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
                {["種別","期間","日数","状態"].map(function(h) { return <th key={h} style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>{h}</th>; })}
                {isAdmin && <th style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {leaves.map(function(l, i) {
                const emp = empMap[l.employee_id];
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid " + GRID, background: i % 2 === 0 ? "transparent" : PANEL + "cc" }}>
                    {isAdmin && <td style={{ padding: "12px 16px", color: TEXT, fontWeight: 600 }}>{emp ? emp.name : "-"}</td>}
                    <td style={{ padding: "12px 16px", color: TEXTSUB }}>{l.type}</td>
                    <td style={{ padding: "12px 16px", color: TEXT, fontFamily: "monospace", fontSize: 12 }}>{l.from_date} - {l.to_date}</td>
                    <td style={{ padding: "12px 16px", color: ACCENT, fontWeight: 800 }}>{l.days}日</td>
                    <td style={{ padding: "12px 16px" }}><Badge label={l.status} color={l.status === "承認済" ? GREEN : l.status === "却下" ? RED : YELLOW} /></td>
                    {isAdmin && (
                      <td style={{ padding: "12px 16px" }}>
                        {l.status === "申請中" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={function() { updateStatus(l.id, "承認済"); }} style={{ background: GREENSOFT, color: GREEN, border: "1px solid " + GREEN + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>承認</button>
                            <button onClick={function() { updateStatus(l.id, "却下"); }} style={{ background: REDSOFT, color: RED, border: "1px solid " + RED + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>却下</button>
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

//  従業員管理 
function EmployeeView(props) {
  const [employees, setEmployees] = useState(props.employees);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const emptyForm = { name: "", dept: "", email: "", password: "0000", paid_days: 20, used_paid_days: 0, is_admin: false };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function reload() { const data = await api.getEmployees(); setEmployees(data); props.onUpdate(data); }

  function openNew() { setEditTarget(null); setForm(emptyForm); setShowForm(true); setError(null); }
  function openEdit(emp) {
    setEditTarget(emp);
    setForm({ name: emp.name, dept: emp.dept || "", email: emp.email || "", password: emp.password || "0000", paid_days: emp.paid_days || 20, used_paid_days: emp.used_paid_days || 0, is_admin: emp.is_admin || false });
    setShowForm(true); setError(null);
  }

  function setF(key, val) { setForm(function(prev) { const next = Object.assign({}, prev); next[key] = val; return next; }); }

  async function save() {
    if (!form.name) { setError("氏名は必須です"); return; }
    setSaving(true); setError(null);
    try {
      if (editTarget) { await api.updateEmployee(editTarget.id, form); } else { await api.createEmployee(form); }
      setShowForm(false); await reload();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function deleteEmp(emp) {
    if (!window.confirm(emp.name + " を削除しますか？")) return;
    await api.deleteEmployee(emp.id); await reload();
  }

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
          <div style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>{editTarget ? "従業員を編集" : "新規従業員を追加"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { label: "氏名 *", key: "name", placeholder: "山田 太郎" },
              { label: "メールアドレス", key: "email", placeholder: "yamada@example.com" },
              { label: "パスワード", key: "password", placeholder: "0000" },
            ].map(function(item) {
              return (
                <div key={item.key}>
                  <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>{item.label}</label>
                  <input value={form[item.key]} onChange={function(e) { setF(item.key, e.target.value); }} placeholder={item.placeholder}
                    style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
                </div>
              );
            })}
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>有給付与日数</label>
              <input type="number" value={form.paid_days} onChange={function(e) { setF("paid_days", parseInt(e.target.value)||0); }}
                style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>有給取得済日数</label>
              <input type="number" value={form.used_paid_days} onChange={function(e) { setF("used_paid_days", parseInt(e.target.value)||0); }}
                style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
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
              style={{ background: "#f0f4f8", color: TEXTSUB, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
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
              {["氏名","有給残","権限","操作"].map(function(h) {
                return <th key={h} style={{ padding: "13px 16px", textAlign: "left", color: TEXTSUB, fontWeight: 700, fontSize: 11, textTransform: "uppercase", borderBottom: "1px solid " + BORDER }}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map(function(e, i) {
              return (
                <tr key={e.id} style={{ borderTop: "1px solid " + GRID, background: i % 2 === 0 ? "transparent" : PANEL + "cc" }}>
                  <td style={{ padding: "13px 16px", color: TEXT, fontWeight: 700 }}>{e.name}</td>
                  <td style={{ padding: "13px 16px", color: GREEN, fontWeight: 800, fontFamily: "monospace" }}>{((e.paid_days||0)-(e.used_paid_days||0))+"日"}</td>
                  <td style={{ padding: "13px 16px" }}><Badge label={e.is_admin ? "管理者" : "一般"} color={e.is_admin ? ACCENT : MUTED} /></td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={function() { openEdit(e); }} style={{ background: ACCENTSOFT, color: ACCENT, border: "1px solid " + ACCENT + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>編集</button>
                      <button onClick={function() { deleteEmp(e); }} style={{ background: REDSOFT, color: RED, border: "1px solid " + RED + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>削除</button>
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

//  ダッシュボード 
function SiteView() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const emptyForm = { name: "", client: "", lat: "", lng: "" };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [addrQuery, setAddrQuery] = useState("");
  const [addrResults, setAddrResults] = useState([]);
  const [addrSearching, setAddrSearching] = useState(false);

  async function reload() { setLoading(true); const data = await api.getSites(); setSites(data); setLoading(false); }
  useEffect(function() { reload(); }, []);

  function openNew() { setEditTarget(null); setForm(emptyForm); setShowForm(true); setError(null); setAddrQuery(""); setAddrResults([]); }
  function openEdit(s) {
    setEditTarget(s);
    setForm({ name: s.name, client: s.client || "", lat: s.lat || "", lng: s.lng || "" });
    setShowForm(true); setError(null); setAddrQuery(""); setAddrResults([]);
  }
  function setF(key, val) { setForm(function(prev) { const next = Object.assign({}, prev); next[key] = val; return next; }); }

  async function getCurrentGps() {
    setLocating(true);
    const loc = await getLocation();
    setLocating(false);
    if (loc) { setF("lat", loc.lat); setF("lng", loc.lng); }
    else { setError("GPS取得に失敗しました"); }
  }

  async function searchAddress() {
    if (!addrQuery.trim()) return;
    setAddrSearching(true); setAddrResults([]); setError(null);
    try {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(addrQuery) + "&format=json&limit=5&accept-language=ja&countrycodes=jp",
        { headers: { "User-Agent": "SanoKogyo-Kintai/1.0" } }
      );
      const data = await res.json();
      setAddrResults(data);
      if (data.length === 0) setError("住所が見つかりませんでした");
    } catch (e) { setError("住所検索に失敗しました"); }
    setAddrSearching(false);
  }

  function selectAddress(item) {
    setF("lat", parseFloat(item.lat));
    setF("lng", parseFloat(item.lon));
    setAddrResults([]);
    setAddrQuery(item.display_name.slice(0, 60));
  }

  async function save() {
    if (!form.name) { setError("現場名は必須です"); return; }
    setSaving(true); setError(null);
    try {
      const data = { name: form.name, client: form.client || null, lat: form.lat !== "" ? parseFloat(form.lat) : null, lng: form.lng !== "" ? parseFloat(form.lng) : null };
      if (editTarget) { await api.updateSite(editTarget.id, data); } else { await api.createSite(data); }
      setShowForm(false); await reload();
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  async function deleteSite(s) {
    if (!window.confirm(s.name + " を削除しますか？")) return;
    await api.deleteSite(s.id); await reload();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ color: TEXT, margin: 0, fontSize: 16, fontWeight: 800 }}>現場管理</h3>
        <button onClick={openNew}
          style={{ background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + 現場を追加
        </button>
      </div>

      {showForm && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 16 }}>{editTarget ? "現場を編集" : "現場を追加"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>現場名 *</label>
              <input value={form.name} onChange={function(e) { setF("name", e.target.value); }} placeholder="〇〇工事現場"
                style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>元請け名</label>
              <input value={form.client} onChange={function(e) { setF("client", e.target.value); }} placeholder="〇〇建設"
                style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 }}>住所から座標を検索</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={addrQuery} onChange={function(e) { setAddrQuery(e.target.value); }}
                  onKeyDown={function(e) { if (e.key === "Enter") searchAddress(); }}
                  placeholder="例: 北海道登別市中登別町..."
                  style={{ flex: 1, background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
                <button onClick={searchAddress} disabled={addrSearching}
                  style={{ background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: addrSearching ? "not-allowed" : "pointer", opacity: addrSearching ? 0.6 : 1, whiteSpace: "nowrap" }}>
                  {addrSearching ? "検索中..." : "検索"}
                </button>
              </div>
              {addrResults.length > 0 && (
                <div style={{ marginTop: 6, background: "#fff", border: "1px solid " + BORDER, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                  {addrResults.map(function(item, i) {
                    return (
                      <button key={i} onClick={function() { selectAddress(item); }}
                        style={{ display: "block", width: "100%", background: "none", border: "none", borderTop: i === 0 ? "none" : "1px solid " + BORDER, padding: "10px 14px", textAlign: "left", cursor: "pointer", fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                        {item.display_name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 8 }}>GPS座標</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ color: MUTED, fontSize: 10, display: "block", marginBottom: 4 }}>緯度</label>
                  <input type="number" step="0.000001" value={form.lat} onChange={function(e) { setF("lat", e.target.value); }} placeholder="43.06417"
                    style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
                </div>
                <div>
                  <label style={{ color: MUTED, fontSize: 10, display: "block", marginBottom: 4 }}>経度</label>
                  <input type="number" step="0.000001" value={form.lng} onChange={function(e) { setF("lng", e.target.value); }} placeholder="141.34694"
                    style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={getCurrentGps} disabled={locating}
                  style={{ background: "#e8f1fd", color: PRIMARY, border: "1px solid " + PRIMARY + "44", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 12, cursor: locating ? "not-allowed" : "pointer", opacity: locating ? 0.6 : 1 }}>
                  {locating ? "GPS取得中..." : "現在地を使う"}
                </button>
                {form.lat && form.lng && (
                  <a href={"https://www.google.com/maps?q=" + form.lat + "," + form.lng} target="_blank" rel="noreferrer"
                    style={{ background: GREENSOFT, color: GREEN, border: "1px solid " + GREEN + "44", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 12, textDecoration: "none" }}>
                    地図で確認
                  </a>
                )}
              </div>
            </div>
          </div>
          {error && <div style={{ background: REDSOFT, border: "1px solid " + RED + "44", borderRadius: 8, padding: "10px 14px", color: RED, fontSize: 13, marginTop: 14 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={save} disabled={saving}
              style={{ background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={function() { setShowForm(false); }}
              style={{ background: "#f0f4f8", color: TEXTSUB, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              キャンセル
            </button>
          </div>
        </Card>
      )}

      {loading ? <Spinner /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sites.map(function(s) {
            return (
              <div key={s.id} style={{ background: CARD, border: "1px solid " + BORDER, borderRadius: 10, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + PRIMARY + ", " + ACCENT + ")" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: TEXT, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{s.name}</div>
                    {s.client && <div style={{ color: TEXTSUB, fontSize: 12, marginBottom: 6 }}>元請け: {s.client}</div>}
                    {s.lat && s.lng ? (
                      <a href={"https://www.google.com/maps?q=" + s.lat + "," + s.lng} target="_blank" rel="noreferrer"
                        style={{ color: ACCENT, fontSize: 12, textDecoration: "none" }}>
                        地図で確認
                      </a>
                    ) : (
                      <span style={{ color: MUTED, fontSize: 12 }}>座標未設定</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <button onClick={function() { openEdit(s); }}
                      style={{ background: "#e8f1fd", color: PRIMARY, border: "1px solid " + PRIMARY + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>編集</button>
                    <button onClick={function() { deleteSite(s); }}
                      style={{ background: REDSOFT, color: RED, border: "1px solid " + RED + "44", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>削除</button>
                  </div>
                </div>
              </div>
            );
          })}
          {sites.length === 0 && <div style={{ textAlign: "center", color: MUTED, padding: 40 }}>現場が登録されていません</div>}
        </div>
      )}
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
      setAttendance(results[0]); setLeaves(results[1]); setLoading(false);
    });
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStr = new Date().toISOString().slice(0, 7);
  const todayRecs = attendance.filter(function(r) { return r.date === todayStr; });
  const checkedIn = todayRecs.filter(function(r) { return r.status === "出勤中"; }).length;
  const checkedOut = todayRecs.filter(function(r) { return r.status === "退勤済"; }).length;
  const pending = leaves.filter(function(l) { return l.status === "申請中"; }).length;

  function exportAllCSV() {
    const filtered = attendance.filter(function(r) { return r.date && r.date.slice(0,7) === monthStr; });
    const empMap = {};
    employees.forEach(function(e) { empMap[e.id] = e; });
    const csvRows = [["氏名","日付","出勤","退勤","休憩(分)","労働時間(分)","状態"].join(",")];
    filtered.forEach(function(r) {
      const emp = empMap[r.employee_id];
      csvRows.push([emp ? emp.name : "", r.date, r.check_in ? r.check_in.slice(0,5) : "", r.check_out ? r.check_out.slice(0,5) : "", r.break_mins||0, r.work_mins||0, r.status].join(","));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = monthStr + "_全社員勤怠.csv"; a.click();
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
        <button onClick={exportAllCSV} style={{ background: GREENSOFT, color: GREEN, border: "1px solid " + GREEN + "44", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>今月の全社員CSV出力</button>
      </div>
      {loading ? <Spinner /> : (
        <div style={{ background: CARD, border: "1px solid " + BORDER, borderRadius: 8, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + PRIMARY + ", " + ACCENT + ")" }} />
          <div style={{ padding: "16px 20px", borderBottom: "1px solid " + BORDER }}>
            <span style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>従業員ステータス一覧</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 0 }}>
            {employees.map(function(e, i) {
              const rec = todayRecs.find(function(r) { return r.employee_id === e.id; });
              const monthWork = attendance.filter(function(r) { return r.employee_id === e.id && r.date && r.date.slice(0,7) === monthStr; }).reduce(function(s, r) { return s + (r.work_mins||0); }, 0);
              const recStatus = rec ? rec.status : "未出勤";
              const recColor = rec && rec.status === "出勤中" ? GREEN : rec && rec.status === "退勤済" ? STEEL : YELLOW;
              return (
                <div key={e.id} style={{ padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid " + GRID, borderRight: "1px solid " + GRID, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: TEXT, fontWeight: 700, fontSize: 14 }}>{e.name}</span>
                    <Badge label={recStatus} color={recColor} />
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div>
                      <div style={{ color: MUTED, fontSize: 10, textTransform: "uppercase", marginBottom: 2 }}>有給残</div>
                      <div style={{ color: GREEN, fontWeight: 800, fontFamily: "monospace", fontSize: 14 }}>{((e.paid_days||0)-(e.used_paid_days||0))+"日"}</div>
                    </div>
                    <div>
                      <div style={{ color: MUTED, fontSize: 10, textTransform: "uppercase", marginBottom: 2 }}>今月稼働</div>
                      <div style={{ color: ACCENT, fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>{hhmm(monthWork)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

//  パスワード変更 
function PasswordView(props) {
  const currentEmp = props.currentEmp;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  async function save() {
    setMsg(null); setError(null);
    if (current !== currentEmp.password) { setError("現在のパスワードが違います"); return; }
    if (next.length < 4) { setError("新しいパスワードは4文字以上にしてください"); return; }
    if (next !== confirm) { setError("新しいパスワードが一致しません"); return; }
    setSaving(true);
    try {
      await api.updateEmployee(currentEmp.id, { password: next });
      props.onPasswordChanged(next);
      setMsg("パスワードを変更しました");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  return (
    <div>
      <h3 style={{ color: TEXT, margin: "0 0 20px", fontSize: 16, fontWeight: 800 }}>パスワード変更</h3>
      <Card style={{ maxWidth: 420 }}>
        {[
          { label: "現在のパスワード", val: current, set: setCurrent },
          { label: "新しいパスワード", val: next, set: setNext },
          { label: "新しいパスワード(確認)", val: confirm, set: setConfirm },
        ].map(function(item) {
          return (
            <div key={item.label} style={{ marginBottom: 16 }}>
              <label style={{ color: TEXTSUB, fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase" }}>{item.label}</label>
              <input type="password" value={item.val} onChange={function(e) { item.set(e.target.value); }}
                style={{ width: "100%", background: "#f8fafc", color: TEXT, border: "1px solid " + BORDER, borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }} />
            </div>
          );
        })}
        {error && <div style={{ background: REDSOFT, border: "1px solid " + RED + "44", borderRadius: 8, padding: "10px 14px", color: RED, fontSize: 13, marginBottom: 14 }}>{error}</div>}
        {msg && <div style={{ background: GREENSOFT, border: "1px solid " + GREEN + "44", borderRadius: 8, padding: "10px 14px", color: GREEN, fontSize: 13, marginBottom: 14 }}>{msg}</div>}
        <button onClick={save} disabled={saving}
          style={{ background: "linear-gradient(135deg, " + PRIMARY + ", " + PRIMARYLT + ")", color: "#fff", border: "none", borderRadius: 8, padding: "10px 28px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "変更中..." : "変更する"}
        </button>
      </Card>
    </div>
  );
}

//  メインアプリ 
export default function App() {
  const [employees, setEmployees] = useState([]);
  const [loggedInEmp, setLoggedInEmp] = useState(null);
  const [tab, setTab] = useState("punch");
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(function() {
    window.addEventListener("beforeinstallprompt", function(e) {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    });
    window.addEventListener("appinstalled", function() { setShowInstall(false); });
  }, []);

  function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then(function() { setInstallPrompt(null); setShowInstall(false); });
  }

  useEffect(function() {
    api.getEmployees()
      .then(function(emps) { setEmployees(emps); })
      .catch(function(e) { setDbError(e.message); })
      .finally(function() { setLoadingEmps(false); });
  }, []);

  function handleLogin(emp) { setLoggedInEmp(emp); setTab(emp.is_admin ? "dashboard" : "punch"); }
  function handleLogout() { setLoggedInEmp(null); }
  function handlePasswordChanged(newPw) {
    setLoggedInEmp(function(prev) { const next = Object.assign({}, prev); next.password = newPw; return next; });
    setEmployees(function(prev) { return prev.map(function(e) { return e.id === loggedInEmp.id ? Object.assign({}, e, { password: newPw }) : e; }); });
  }

  const isAdmin = loggedInEmp && loggedInEmp.is_admin;

  const tabs = isAdmin
    ? [{ id: "punch", text: "打刻" }, { id: "dashboard", text: "ダッシュボード" }, { id: "history", text: "勤怠一覧" }, { id: "leave", text: "休暇申請" }, { id: "employees", text: "従業員管理" }, { id: "sites", text: "現場管理" }, { id: "password", text: "PW変更" }]
    : [{ id: "punch", text: "打刻" }, { id: "history", text: "勤怠履歴" }, { id: "leave", text: "休暇申請" }, { id: "password", text: "PW変更" }];

  if (loadingEmps) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} *{box-sizing:border-box;margin:0;padding:0} body{background:#f0f4f8}"}</style>
        <Spinner />
      </div>
    );
  }

  if (dbError) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: RED, fontSize: 14, padding: 24 }}>
        <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} *{box-sizing:border-box;margin:0;padding:0} body{background:#f0f4f8}"}</style>
        Supabase接続エラー: {dbError}
      </div>
    );
  }

  if (!loggedInEmp) {
    return (
      <div>
        <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%{transform:scale(1)}30%{transform:scale(0.92)}60%{transform:scale(1.06)}100%{transform:scale(1)}} @keyframes ripple{0%{transform:scale(0);opacity:0.6}100%{transform:scale(4);opacity:0}} *{box-sizing:border-box;margin:0;padding:0} body{background:#f5f7fa;overflow-x:hidden} .punch-btn{transition:box-shadow 0.15s,opacity 0.15s} .punch-btn:active{filter:brightness(0.92)}"}</style>
        <LoginView employees={employees} onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: "'Inter','Noto Sans JP',sans-serif" }}>
      <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%{transform:scale(1)}30%{transform:scale(0.92)}60%{transform:scale(1.06)}100%{transform:scale(1)}} @keyframes ripple{0%{transform:scale(0);opacity:0.6}100%{transform:scale(4);opacity:0}} *{box-sizing:border-box;margin:0;padding:0} body{background:#f5f7fa;overflow-x:hidden} .punch-btn{transition:box-shadow 0.15s,opacity 0.15s} .punch-btn:active{filter:brightness(0.92)}"}</style>
      <div style={{ background: PANEL, borderBottom: "1px solid " + BORDER, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, " + PRIMARY + ", " + ACCENT + ")", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🏗</div>
          <span style={{ fontWeight: 800, fontSize: 14, color: TEXT, whiteSpace: "nowrap" }}>佐野工業</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ color: TEXTSUB, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loggedInEmp.name}</span>
          {isAdmin && <span style={{ background: ACCENT + "28", color: ACCENT, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, border: "1px solid " + ACCENT + "44", flexShrink: 0 }}>管理者</span>}
          <button onClick={handleLogout}
            style={{ background: "#f0f4f8", color: TEXTSUB, border: "1px solid " + BORDER, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
            ログアウト
          </button>
        </div>
      </div>
      {showInstall && (
        <div style={{ background: "linear-gradient(90deg, " + PRIMARY + ", " + ACCENT + ")", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>ホーム画面に追加してオフラインでも使えます</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleInstall}
              style={{ background: "#fff", color: PRIMARY, border: "none", borderRadius: 8, padding: "6px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              追加する
            </button>
            <button onClick={function() { setShowInstall(false); }}
              style={{ background: "transparent", color: "#fff", border: "1px solid #ffffff66", borderRadius: 8, padding: "6px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              後で
            </button>
          </div>
        </div>
      )}
      <div style={{ background: PANEL, borderBottom: "1px solid " + BORDER, padding: "0 16px", display: "flex", overflowX: "auto", borderBottom: "2px solid " + BORDER }}>
        {tabs.map(function(t) {
          return (
            <button key={t.id} onClick={function() { setTab(t.id); }}
              style={{ background: "none", border: "none", borderBottom: tab === t.id ? "3px solid " + ACCENT : "3px solid transparent", color: tab === t.id ? ACCENT : MUTED, padding: "14px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
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
        {tab === "sites"     && <SiteView />}
        {tab === "password"  && <PasswordView currentEmp={loggedInEmp} onPasswordChanged={handlePasswordChanged} />}
      </div>
    </div>
  );
}
