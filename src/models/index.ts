import { Schema, Types, model } from 'mongoose';
import { DATE_RE, TIME_RE } from '../utils/time';

const opts = { timestamps: true, versionKey: false } as const;

export const Student = model('Student', new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  grade: { type: String, trim: true, default: '' },
  pricePerSession: { type: Number, min: 0, default: 0 },
  notes: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, opts));

export const Teacher = model('Teacher', new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  subject: { type: String, trim: true, default: '' },
  ratePerSession: { type: Number, min: 0, default: 0 },
  notes: { type: String, default: '' },
  active: { type: Boolean, default: true },
}, opts));

const sessionSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
  subject: { type: String, trim: true, default: '' },
  date: { type: String, required: true, match: DATE_RE },
  startTime: { type: String, required: true, match: TIME_RE },
  durationMin: { type: Number, min: 5, max: 600, default: 60 },
  studentPrice: { type: Number, min: 0, required: true },
  teacherPay: { type: Number, min: 0, required: true },
  notes: { type: String, default: '' },
}, opts);
sessionSchema.index({ date: 1, startTime: 1 });
export const Session = model('Session', sessionSchema);

export const Payment = model('Payment', new Schema({
  kind: { type: String, enum: ['student', 'teacher'], required: true },
  person: { type: Schema.Types.ObjectId, required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: String, required: true, match: DATE_RE },
  note: { type: String, default: '' },
}, opts));

export type Id = Types.ObjectId;
