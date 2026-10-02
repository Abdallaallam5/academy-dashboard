import { Router } from 'express';
import { z } from 'zod';
import { Session, Student, Teacher } from '../models';
import { HttpError, wrap } from '../utils/http';
import { DATE_RE, MONTH_RE, TIME_RE, fmtDate, overlaps } from '../utils/time';

const fields = {
  student: z.string().min(1),
  teacher: z.string().min(1),
  subject: z.string().trim().default(''),
  date: z.string().regex(DATE_RE, 'تاريخ غير صحيح'),
  startTime: z.string().regex(TIME_RE, 'ساعة غير صحيحة'),
  durationMin: z.coerce.number().int().min(5).max(600).default(60),
  studentPrice: z.coerce.number().min(0),
  teacherPay: z.coerce.number().min(0),
  notes: z.string().default(''),
};
const createSchema = z.object(fields);
const { date: _d, ...bulkFields } = fields;
const bulkSchema = z.object({
  ...bulkFields,
  month: z.string().regex(MONTH_RE, 'شهر غير صحيح'),
  fromDate: z.string().regex(DATE_RE, 'تاريخ غير صحيح').optional(),   // اختياري: ابدأ من يوم معين في الشهر
  days: z.array(z.number().int().min(0).max(6)).min(1, 'اختار يوم واحد على الأقل'),
});

type Slot = { student: string; teacher: string; date: string; startTime: string; durationMin: number };

/** يرجع سبب التعارض (مدرس أو طالب عنده حصة في نفس الوقت) أو null */
async function findConflict(s: Slot, ignoreId?: string): Promise<string | null> {
  const same = await Session.find({
    date: s.date,
    $or: [{ teacher: s.teacher }, { student: s.student }],
    ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
  }).lean();
  for (const o of same) {
    if (!overlaps(s.startTime, s.durationMin, o.startTime, o.durationMin!)) continue;
    return String(o.teacher) === s.teacher ? 'المدرس عنده حصة في نفس الوقت' : 'الطالب عنده حصة في نفس الوقت';
  }
  return null;
}

async function assertPeople(student: string, teacher: string) {
  const [s, t] = await Promise.all([Student.exists({ _id: student }), Teacher.exists({ _id: teacher })]);
  if (!s) throw new HttpError(400, 'الطالب غير موجود');
  if (!t) throw new HttpError(400, 'المدرس غير موجود');
}

export const sessionsRouter = Router();

sessionsRouter.get('/', wrap(async (req, res) => {
  const { month, from, to, student, teacher } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (month) {
    if (!MONTH_RE.test(month)) throw new HttpError(400, 'شهر غير صحيح');
    filter.date = { $regex: `^${month}` };
  } else if (from || to) {
    filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  }
  if (student) filter.student = student;
  if (teacher) filter.teacher = teacher;
  res.json(await Session.find(filter).sort({ date: 1, startTime: 1 })
    .populate('student', 'name phone').populate('teacher', 'name phone').lean());
}));

sessionsRouter.post('/', wrap(async (req, res) => {
  const data = createSchema.parse(req.body);
  await assertPeople(data.student, data.teacher);
  const conflict = await findConflict(data);
  if (conflict) throw new HttpError(409, conflict);
  res.status(201).json(await Session.create(data));
}));

sessionsRouter.post('/bulk', wrap(async (req, res) => {
  const { month, fromDate, days, ...rest } = bulkSchema.parse(req.body);
  await assertPeople(rest.student, rest.teacher);
  const toCreate: unknown[] = [];
  const skipped: { date: string; reason: string }[] = [];

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m - 1, day);
    if (fromDate && fmtDate(d) < fromDate) continue;
    if (!days.includes(d.getDay())) continue;
    const slot = { student: rest.student, teacher: rest.teacher, date: fmtDate(d), startTime: rest.startTime, durationMin: rest.durationMin };
    const conflict = await findConflict(slot);
    if (conflict) { skipped.push({ date: slot.date, reason: conflict }); continue; }
    toCreate.push({ ...rest, date: slot.date });
  }
  const docs = await Session.insertMany(toCreate);
  res.status(201).json({ created: docs.length, skipped, sessions: docs });
}));

sessionsRouter.patch('/:id', wrap(async (req, res) => {
  const data = createSchema.partial().parse(req.body);
  const cur = await Session.findById(req.params.id);
  if (!cur) throw new HttpError(404, 'غير موجودة');
  const next = { ...cur.toObject(), ...data } as any;
  const timeChanged = ['student', 'teacher', 'date', 'startTime', 'durationMin'].some(k => k in data);
  if (timeChanged) {
    const conflict = await findConflict({
      student: String(next.student), teacher: String(next.teacher),
      date: next.date, startTime: next.startTime, durationMin: next.durationMin,
    }, req.params.id);
    if (conflict) throw new HttpError(409, conflict);
  }
  cur.set(data);
  await cur.save();
  res.json(cur);
}));

sessionsRouter.delete('/:id', wrap(async (req, res) => {
  const r = await Session.findByIdAndDelete(req.params.id);
  if (!r) throw new HttpError(404, 'غير موجودة');
  res.status(204).end();
}));
