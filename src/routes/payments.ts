import { Router } from 'express';
import { z } from 'zod';
import { Payment, Student, Teacher } from '../models';
import { HttpError, wrap } from '../utils/http';
import { DATE_RE, MONTH_RE, todayStr } from '../utils/time';

const schema = z.object({
  kind: z.enum(['student', 'teacher']),
  person: z.string().min(1),
  amount: z.coerce.number().positive('المبلغ لازم يكون أكبر من صفر'),
  date: z.string().regex(DATE_RE).default(todayStr),
  note: z.string().default(''),
});

export const paymentsRouter = Router();

paymentsRouter.get('/', wrap(async (req, res) => {
  const { kind, person, month } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (kind) filter.kind = kind;
  if (person) filter.person = person;
  if (month) {
    if (!MONTH_RE.test(month)) throw new HttpError(400, 'شهر غير صحيح');
    filter.date = { $regex: `^${month}` };
  }
  const list = await Payment.find(filter).sort({ date: -1, createdAt: -1 }).lean();
  const [students, teachers] = await Promise.all([Student.find().select('name').lean(), Teacher.find().select('name').lean()]);
  const names = new Map<string, string>([...students, ...teachers].map(p => [String(p._id), p.name]));
  res.json(list.map(p => ({ ...p, personName: names.get(String(p.person)) || '—' })));
}));

paymentsRouter.post('/', wrap(async (req, res) => {
  const data = schema.parse(req.body);
  const exists = await (data.kind === 'student' ? Student : Teacher).exists({ _id: data.person });
  if (!exists) throw new HttpError(400, 'الشخص غير موجود');
  res.status(201).json(await Payment.create(data));
}));

paymentsRouter.delete('/:id', wrap(async (req, res) => {
  const r = await Payment.findByIdAndDelete(req.params.id);
  if (!r) throw new HttpError(404, 'غير موجودة');
  res.status(204).end();
}));
