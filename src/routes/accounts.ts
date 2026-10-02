import { Router } from 'express';
import { Model, Types } from 'mongoose';
import { Payment, Session, Student, Teacher } from '../models';
import { HttpError, wrap } from '../utils/http';
import { MONTH_RE, todayStr } from '../utils/time';

type Kind = 'student' | 'teacher';
const amountField = (k: Kind) => (k === 'student' ? '$studentPrice' : '$teacherPay');
const personModel = (k: Kind) => (k === 'student' ? Student : Teacher) as Model<any>;
const monthOf = (q: unknown) => {
  const m = String(q || todayStr().slice(0, 7));
  if (!MONTH_RE.test(m)) throw new HttpError(400, 'شهر غير صحيح');
  return m;
};
const total = (rows: any[], k: string) => rows.reduce((a, r) => a + r[k], 0);

/** حساب كل شخص: عن الشهر + الرصيد التراكمي (إجمالي الحصص − المدفوع) */
async function ledger(kind: Kind, month: string) {
  const inMonth = { date: { $regex: `^${month}` } };
  const sessionGroup = (match: object) => Session.aggregate([
    { $match: match },
    { $group: { _id: `$${kind}`, count: { $sum: 1 }, amount: { $sum: amountField(kind) } } },
  ]);
  const paymentGroup = (match: object) => Payment.aggregate([
    { $match: { kind, ...match } },
    { $group: { _id: '$person', amount: { $sum: '$amount' } } },
  ]);
  const [monthSessions, allSessions, payMonth, payAll, people] = await Promise.all([
    sessionGroup(inMonth), sessionGroup({}), paymentGroup(inMonth), paymentGroup({}),
    personModel(kind).find().sort({ name: 1 }).lean(),
  ]);

  const toMap = (rows: any[], f: string) => new Map<string, number>(rows.map(r => [String(r._id), r[f]]));
  const mCount = toMap(monthSessions, 'count'), mDue = toMap(monthSessions, 'amount');
  const aDue = toMap(allSessions, 'amount'), paidM = toMap(payMonth, 'amount'), paidAll = toMap(payAll, 'amount');

  return (people as any[]).map(p => {
    const id = String(p._id);
    const totalDue = aDue.get(id) || 0, totalPaid = paidAll.get(id) || 0;
    return {
      _id: id, name: p.name, phone: p.phone, active: p.active,
      sessions: mCount.get(id) || 0, monthDue: mDue.get(id) || 0, monthPaid: paidM.get(id) || 0,
      totalDue, totalPaid, balance: totalDue - totalPaid,
    };
  });
}

const summarize = (students: any[], teachers: any[]) => ({
  income: total(students, 'monthDue'),
  teacherCost: total(teachers, 'monthDue'),
  net: total(students, 'monthDue') - total(teachers, 'monthDue'),
  studentsOwe: total(students, 'balance'),
  owedToTeachers: total(teachers, 'balance'),
  collected: total(students, 'monthPaid'),
  paidOut: total(teachers, 'monthPaid'),
  sessions: total(students, 'sessions'),
});

export const accountsRouter = Router();

accountsRouter.get('/accounts', wrap(async (req, res) => {
  const month = monthOf(req.query.month);
  const [students, teachers] = await Promise.all([ledger('student', month), ledger('teacher', month)]);
  const relevant = (r: any) => r.active || r.sessions || r.balance;
  res.json({ month, summary: summarize(students, teachers), students: students.filter(relevant), teachers: teachers.filter(relevant) });
}));

accountsRouter.get('/dashboard', wrap(async (_req, res) => {
  const today = todayStr();
  const month = today.slice(0, 7);
  const [sessions, students, teachers] = await Promise.all([
    Session.find({ date: today }).sort({ startTime: 1 })
      .populate('student', 'name phone').populate('teacher', 'name phone').lean(),
    ledger('student', month), ledger('teacher', month),
  ]);
  res.json({
    today, sessions, month: summarize(students, teachers),
    counts: { students: students.filter(x => x.active).length, teachers: teachers.filter(x => x.active).length },
  });
}));

/** جدول وكشف حساب شخص واحد (بيستخدمه الـ PDF) */
accountsRouter.get('/statements/:kind/:id', wrap(async (req, res) => {
  const kind = req.params.kind as Kind;
  if (kind !== 'student' && kind !== 'teacher') throw new HttpError(400, 'نوع غير صحيح');
  const month = monthOf(req.query.month);
  const id = req.params.id;
  const person: any = await personModel(kind).findById(id).lean();
  if (!person) throw new HttpError(404, 'غير موجود');
  const other = kind === 'student' ? 'teacher' : 'student';
  const oid = new Types.ObjectId(id);

  const [sessions, payments, allSessions, allPaid] = await Promise.all([
    Session.find({ [kind]: id, date: { $regex: `^${month}` } }).sort({ date: 1, startTime: 1 }).populate(other, 'name').lean(),
    Payment.find({ kind, person: id, date: { $regex: `^${month}` } }).sort({ date: 1 }).lean(),
    Session.aggregate([{ $match: { [kind]: oid } }, { $group: { _id: null, a: { $sum: amountField(kind) } } }]),
    Payment.aggregate([{ $match: { kind, person: oid } }, { $group: { _id: null, a: { $sum: '$amount' } } }]),
  ]);

  const amt = (s: any) => (kind === 'student' ? s.studentPrice : s.teacherPay);
  res.json({
    kind, month, person: { _id: id, name: person.name, phone: person.phone },
    sessions: sessions.map(s => ({ ...s, other: (s as any)[other]?.name || '—', amount: amt(s) })),
    payments,
    totals: {
      sessions: sessions.length,
      due: sessions.reduce((a, s) => a + amt(s), 0),
      paid: payments.reduce((a, p) => a + p.amount, 0),
      balance: (allSessions[0]?.a || 0) - (allPaid[0]?.a || 0),
    },
  });
}));
