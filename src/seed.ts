import { connectDb } from './db';
import { Payment, Session, Student, Teacher } from './models';
import { fmtDate, todayStr } from './utils/time';

/** بيانات تجريبية كاملة: مدرسين وطلاب وجداول 3 شهور (آخر شهرين + الشهر الحالي) ودفعات.
 *  ثابتة (نفس البيانات كل مرة) وبدون أي تعارض في المواعيد. */

let seedState = 20260101;
const rnd = () => {                                   // mulberry32 — عشوائي ثابت
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = <T>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

const TEACHERS = [
  { name: 'أ. محمد عبد الرحمن', subject: 'رياضيات', rate: 150 },
  { name: 'أ. سارة حسن', subject: 'إنجليزي', rate: 130 },
  { name: 'أ. أحمد فتحي', subject: 'فيزياء', rate: 160 },
  { name: 'أ. منى إبراهيم', subject: 'كيمياء', rate: 150 },
  { name: 'أ. خالد مصطفى', subject: 'لغة عربية', rate: 120 },
  { name: 'أ. هبة سمير', subject: 'أحياء', rate: 140 },
  { name: 'أ. عمرو جمال', subject: 'علوم', rate: 110 },
  { name: 'أ. نورا عادل', subject: 'دراسات', rate: 100 },
];
const FIRST = ['أحمد', 'محمد', 'مريم', 'يوسف', 'فاطمة', 'عمر', 'نور', 'كريم', 'سلمى', 'آدم', 'ليلى', 'مصطفى', 'هنا', 'إياد', 'جنى', 'زياد', 'ملك', 'تميم', 'رودينا', 'حمزة'];
const LAST = ['خالد', 'سامي', 'عمرو', 'إبراهيم', 'حسين', 'طارق', 'ماهر', 'رضا', 'فؤاد', 'نصر'];
const GRADES = [
  { grade: 'ابتدائي', price: 180, subjects: ['رياضيات', 'إنجليزي', 'لغة عربية', 'علوم'] },
  { grade: 'إعدادي', price: 220, subjects: ['رياضيات', 'إنجليزي', 'لغة عربية', 'علوم', 'دراسات'] },
  { grade: 'ثانوي', price: 280, subjects: ['رياضيات', 'فيزياء', 'كيمياء', 'أحياء', 'إنجليزي', 'لغة عربية'] },
];
const DAY_PAIRS = [[6, 2], [0, 3], [1, 4], [6, 3], [0, 4], [1, 2], [6, 1], [0, 2]];  // 0=الأحد … 6=السبت
const HOURS = [13, 14, 15, 16, 17, 18, 19, 20];
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export async function seedDemo(force = false) {
  const existing = await Promise.all([Student.countDocuments(), Teacher.countDocuments(), Session.countDocuments()]);
  if (existing.some(Boolean)) {
    if (!force) throw new Error('الداتا بيز فيها بيانات بالفعل. استخدم --force لو عايز تمسحها وتحط البيانات التجريبية.');
    await Promise.all([Student.deleteMany({}), Teacher.deleteMany({}), Session.deleteMany({}), Payment.deleteMany({})]);
  }
  seedState = 20260101;

  const phone = (i: number) => `01${['0', '1', '2', '5'][i % 4]}${String(10000000 + ((i * 7919 + 12345) % 89999999)).slice(0, 8)}`;
  const teachers = await Teacher.insertMany(TEACHERS.map((t, i) => ({ name: t.name, phone: phone(i), subject: t.subject, ratePerSession: t.rate })));
  const teacherBySubject = new Map(teachers.map(t => [t.subject, t]));

  const studentDocs = Array.from({ length: 30 }, (_, i) => {
    const g = GRADES[i % 3];
    return {
      name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / 3) % LAST.length]}`,
      phone: phone(100 + i), grade: g.grade,
      pricePerSession: g.price + [0, 0, 20, -20, 0][i % 5],
      notes: i % 7 === 0 ? 'ولي الأمر بيفضل التواصل واتساب' : '',
    };
  });
  const students = await Student.insertMany(studentDocs);

  // ---- توزيع الحصص الأسبوعية بدون تعارض ----
  const tBusy = new Set<string>(), sBusy = new Set<string>();
  const enrollments: { student: any; teacher: any; days: number[]; hour: number }[] = [];
  students.forEach((st, i) => {
    const g = GRADES[i % 3];
    const wanted = shuffle(g.subjects).slice(0, i % 4 === 0 ? 3 : i % 2 === 0 ? 2 : 1);
    for (const subj of wanted) {
      const teacher = teacherBySubject.get(subj)!;
      let placed = false;
      for (const days of shuffle(DAY_PAIRS)) {
        for (const hour of shuffle(HOURS)) {
          const free = days.every(d => !tBusy.has(`${teacher.id}|${d}|${hour}`) && !sBusy.has(`${st.id}|${d}|${hour}`));
          if (!free) continue;
          days.forEach(d => { tBusy.add(`${teacher.id}|${d}|${hour}`); sBusy.add(`${st.id}|${d}|${hour}`); });
          enrollments.push({ student: st, teacher, days, hour });
          placed = true; break;
        }
        if (placed) break;
      }
    }
  });

  // ---- الحصص لآخر شهرين + الشهر الحالي ----
  const now = new Date();
  const months = [-2, -1, 0].map(o => new Date(now.getFullYear(), now.getMonth() + o, 1));
  const monthKeys = months.map(d => fmtDate(d).slice(0, 7));
  const sessions: any[] = [];
  for (const first of months) {
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= dim; day++) {
      const d = new Date(first.getFullYear(), first.getMonth(), day);
      for (const e of enrollments) {
        if (!e.days.includes(d.getDay())) continue;
        sessions.push({
          student: e.student._id, teacher: e.teacher._id, subject: e.teacher.subject, date: fmtDate(d),
          startTime: hh(e.hour), durationMin: 60, studentPrice: e.student.pricePerSession, teacherPay: e.teacher.ratePerSession,
        });
      }
    }
  }
  await Session.insertMany(sessions);

  // ---- الدفعات (بدون تواريخ في المستقبل) ----
  const today = todayStr();
  const pdate = (month: string, day: number) => { const d = `${month}-${String(day).padStart(2, '0')}`; return d > today ? today : d; };
  const monthSum = (kind: 'student' | 'teacher', id: string, month: string) => sessions
    .filter(s => String(s[kind]) === id && s.date.startsWith(month))
    .reduce((a, s) => a + (kind === 'student' ? s.studentPrice : s.teacherPay), 0);
  const round50 = (n: number) => Math.round(n / 50) * 50;
  const payments: any[] = [];

  students.forEach((st, i) => {
    monthKeys.forEach((m, mi) => {
      const due = monthSum('student', st.id, m);
      if (!due) return;
      const isCurrent = mi === monthKeys.length - 1;
      const r = (i * 13 + mi * 7) % 10;
      let amount: number;
      if (isCurrent) amount = r < 4 ? round50(due * 0.5) : 0;            // الشهر الحالي: بعضهم دفع نص الشهر
      else amount = r < 7 ? due : r < 9 ? round50(due * (0.5 + (r - 7) * 0.2)) : 0;   // الشهور اللي فاتت: أغلبهم دفع كامل
      if (amount > 0) payments.push({ kind: 'student', person: st._id, amount, date: pdate(m, 3 + (i % 8)), note: r < 7 && !isCurrent ? 'دفع كامل' : 'دفعة' });
    });
  });
  teachers.forEach((t, i) => {
    monthKeys.forEach((m, mi) => {
      const due = monthSum('teacher', t.id, m);
      if (!due) return;
      const isCurrent = mi === monthKeys.length - 1;
      let amount = isCurrent ? (i % 2 === 0 ? round50(due * 0.4) : 0) : due;
      if (i === 5 && mi === 0) amount = round50(due * 0.5);               // مدرسة عليها متأخرات
      if (amount > 0) payments.push({ kind: 'teacher', person: t._id, amount, date: pdate(m, 28), note: isCurrent ? 'سلفة' : 'مرتب الشهر' });
    });
  });
  await Payment.insertMany(payments);

  return { teachers: teachers.length, students: students.length, sessions: sessions.length, payments: payments.length, months: monthKeys };
}

async function main() {
  const stop = await connectDb();
  try {
    const r = await seedDemo(process.argv.includes('--force'));
    console.log('✅ تم إضافة البيانات التجريبية:', r);
  } finally { await stop(); }
}
if (require.main === module) main().catch(e => { console.error('❌', e.message); process.exit(1); });
