"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SKILLS = ["الأعداد والعمليات","الكسور","الجبر","الهندسة","حل المسائل"];
const lvl = s => s < 50 ? ["مبتدئ","#c4453b"] : s < 80 ? ["متوسط","#c98a12"] : ["متقدم","#1d8a6a"];

export default function Home() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [cur, setCur] = useState(null);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => l.subscription.unsubscribe();
  }, []);

  const loadStudents = async () => {
    const { data } = await supabase.from("students").select("*").order("name");
    setStudents(data || []);
    if (data?.length && !cur) setCur(data[0].id);
  };
  const loadRows = async () => {
    if (!cur) return setRows([]);
    const { data } = await supabase.from("assessments").select("*").eq("student_id", cur).order("assessed_on");
    setRows(data || []);
  };
  useEffect(() => { if (user) loadStudents(); }, [user]);
  useEffect(() => { loadRows(); }, [cur]);

  async function login(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await supabase.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
    setMsg(error ? "البريد أو كلمة السر غير صحيحة" : "");
  }
  async function addStudent(e) {
    e.preventDefault();
    const name = new FormData(e.target).get("name").trim();
    if (!name) return;
    if (students.length >= 25) return setMsg("الحد الأقصى 25 طالباً");
    const { data } = await supabase.from("students").insert({ name }).select().single();
    e.target.reset(); await loadStudents(); if (data) setCur(data.id);
  }
  async function addAssessment(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    await supabase.from("assessments").insert({
      student_id: cur, skill: f.get("skill"), score: Math.min(100, Math.max(0, +f.get("score"))),
      assessed_on: f.get("date"), note: f.get("note")
    });
    e.target.reset(); loadRows();
  }

  if (!user) return (
    <div className="w"><div className="c">
      <h2>دخول المعلمة</h2>
      <form onSubmit={login}>
        <input name="email" type="email" placeholder="البريد" required /><br />
        <input name="password" type="password" placeholder="كلمة السر" required /><br />
        <button>دخول</button> <span>{msg}</span>
      </form></div></div>
  );

  const s = students.find(x => x.id === cur);
  const last = SKILLS.map(k => { const r = rows.filter(x => x.skill === k).pop(); return r ? r.score : null; });
  const done = last.filter(v => v !== null);
  const avg = done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : null;
  const W = 520, H = 180, p = 28;
  const X = i => p + i * (W - 2 * p) / Math.max(1, rows.length - 1), Y = v => H - p - v / 100 * (H - 2 * p);

  return (
    <div className="w">
      <h1>متابعة تقدم طلاب الرياضيات</h1>
      <button onClick={() => supabase.auth.signOut()}>خروج</button>
      <div className="c">
        {students.map(x => <button key={x.id} className={"chip" + (x.id === cur ? " on" : "")} onClick={() => setCur(x.id)}>{x.name}</button>)}
        <form onSubmit={addStudent}><input name="name" placeholder="اسم طالب جديد" /> <button>إضافة</button> {students.length}/25 {msg}</form>
      </div>
      {s && <>
        <div className="c">
          <h2>{s.name} {avg !== null && <span style={{ color: lvl(avg)[1] }}>— {lvl(avg)[0]} ({avg})</span>}</h2>
          {SKILLS.map((k, i) => <div key={k} style={{ margin: "8px 0" }}>{k}: {last[i] === null ? "لم يُقيَّم" : `${last[i]} (${lvl(last[i])[0]})`}
            {last[i] !== null && <div className="bar"><i style={{ width: last[i] + "%", background: lvl(last[i])[1] }} /></div>}</div>)}
        </div>
        <div className="c"><h2>التقدم عبر الوقت</h2>
          {rows.length < 2 ? "أضيفي تقييمين على الأقل." :
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
              <polyline fill="none" stroke="#1f5fae" strokeWidth="2.5" points={rows.map((r, i) => `${X(i)},${Y(r.score)}`).join(" ")} />
              {rows.map((r, i) => <circle key={r.id} cx={X(i)} cy={Y(r.score)} r="5" fill={lvl(r.score)[1]} />)}
            </svg>}
        </div>
        <div className="c"><h2>إضافة تقييم</h2>
          <form onSubmit={addAssessment}>
            <select name="skill">{SKILLS.map(k => <option key={k}>{k}</option>)}</select><br />
            <input name="score" type="number" min="0" max="100" placeholder="الدرجة" required /><br />
            <input name="date" type="date" required /><br />
            <input name="note" placeholder="ملاحظة (اختياري)" /><br />
            <button>حفظ التقييم</button>
          </form></div>
        <div className="c"><h2>السجل</h2>
          {[...rows].reverse().map(r => <div className="row" key={r.id}><span>{r.skill} {r.note && `— ${r.note}`}</span><b>{r.score} <small>{r.assessed_on}</small></b></div>)}
        </div>
      </>}
    </div>
  );
}
