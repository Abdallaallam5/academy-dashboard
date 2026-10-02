import { Router } from 'express';
import { Model } from 'mongoose';
import { z } from 'zod';
import { Payment, Session, Student, Teacher } from '../models';
import { HttpError, wrap } from '../utils/http';

const base = {
  name: z.string().trim().min(1, 'الاسم مطلوب'),
  phone: z.string().trim().default(''),
  notes: z.string().default(''),
  active: z.boolean().default(true),
};
const studentSchema = z.object({ ...base, grade: z.string().trim().default(''), pricePerSession: z.coerce.number().min(0).default(0) });
const teacherSchema = z.object({ ...base, subject: z.string().trim().default(''), ratePerSession: z.coerce.number().min(0).default(0) });

function crud(kind: 'student' | 'teacher', M: Model<any>, schema: z.ZodObject<any>) {
  const r = Router();

  r.get('/', wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const filter: Record<string, unknown> = {};
    if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (req.query.active === 'true') filter.active = true;
    res.json(await M.find(filter).sort({ name: 1 }).lean());
  }));

  r.post('/', wrap(async (req, res) => {
    res.status(201).json(await M.create(schema.parse(req.body)));
  }));

  r.patch('/:id', wrap(async (req, res) => {
    const doc = await M.findByIdAndUpdate(req.params.id, schema.partial().parse(req.body), { new: true, runValidators: true });
    if (!doc) throw new HttpError(404, 'غير موجود');
    res.json(doc);
  }));

  r.delete('/:id', wrap(async (req, res) => {
    const count = await Session.countDocuments({ [kind]: req.params.id });
    if (count && req.query.force !== '1') {
      throw new HttpError(409, `عنده ${count} حصة مسجلة. الأفضل توقفه (غير نشط) بدل الحذف.`, { sessions: count });
    }
    await Session.deleteMany({ [kind]: req.params.id });
    await Payment.deleteMany({ kind, person: req.params.id });
    await M.findByIdAndDelete(req.params.id);
    res.status(204).end();
  }));

  return r;
}

export const studentsRouter = crud('student', Student, studentSchema);
export const teachersRouter = crud('teacher', Teacher, teacherSchema);
