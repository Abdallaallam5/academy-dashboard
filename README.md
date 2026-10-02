# إدارة الأكاديمية

Node.js + Express + TypeScript + MongoDB (Mongoose). الواجهة عربي RTL بتتقدم من نفس السيرفر.

## تشغيل سريع للعرض (من غير MongoDB)

```bash
npm install
npm run demo        # http://localhost:3000  (admin / admin123)
```
بيشغّل قاعدة مؤقتة في الذاكرة ومعاها بيانات تجريبية كاملة (8 مدرسين، 30 طالب، ~1400 حصة على 3 شهور، ودفعات). البيانات بتضيع عند الإيقاف.

## التشغيل العادي

```bash
cp .env.example .env      # عدّل MONGODB_URI وكلمة السر
npm run dev
```
- للإنتاج: `npm run build && npm start` (لازم تغيّر `JWT_SECRET` و `ADMIN_PASS` وإلا السيرفر مش هيشتغل).

## رفع البيانات التجريبية على الداتا بيز
```bash
# MONGODB_URI في .env يشاور على الداتا بيز (Atlas مثلًا)
npm run seed          # بيرفض لو الداتا بيز فيها بيانات
npm run seed:force    # بيمسح كل حاجة ويحط البيانات التجريبية من جديد
```
أو على السيرفر نفسه: `SEED_ON_START=true` بيحط البيانات أول تشغيل لو الداتا بيز فاضية بس.

## النشر على لينك (Atlas + Render)
1. **MongoDB Atlas:** اعمل Cluster مجاني ← Database Access (يوزر وباسورد) ← Network Access (اسمح `0.0.0.0/0`) ← Connect ← انسخ رابط الاتصال وضيف في آخره اسم الداتا بيز (`/academy`).
2. ارفع المشروع على GitHub (`.env` متجاهَل تلقائي).
3. **Render:** New ← Blueprint ← اختار الريبو (بيقرا `render.yaml`) ← ادخل `MONGODB_URI` و `ADMIN_PASS` ← Deploy. هتاخد لينك `https://academy-xxxx.onrender.com`.
   النسخة المجانية بتنام بعد فترة خمول وأول فتح بياخد حوالي دقيقة، فافتحه قبل العميل بدقيقتين.
4. بعد العرض شيل `SEED_ON_START` وامسح البيانات التجريبية قبل ما تبدأ شغل حقيقي (`npm run seed:force` بيمسح كل حاجة، فاستخدمه بس على داتا بيز العرض).

## النشر على Vercel (مجاني)
الملفات جاهزة: `api/index.ts` (الـ API كـ serverless function) و`vercel.json` (الواجهة من `public/` + توجيه `/api/*`).
1. ارفع المشروع على GitHub (الـ `.env` متجاهَل تلقائي).
2. vercel.com ← Add New Project ← اختار الريبو ← **Framework Preset: Other** ← قبل Deploy ضيف Environment Variables:
   `MONGODB_URI` · `JWT_SECRET` (نص طويل عشوائي) · `ADMIN_USER` · `ADMIN_PASS` (مش `admin123`) · `ACADEMY_NAME`
   (السيرفر بيرفض يشتغل في الإنتاج لو الباسورد أو السر على القيمة الافتراضية.)
3. في Atlas ← Network Access ← اسمح `0.0.0.0/0` (Vercel مالوش IP ثابت).
4. Deploy. البيانات التجريبية ارفعها من جهازك: `npm run seed` (بتستخدم `MONGODB_URI` من `.env`).
بدل GitHub ممكن: `npm i -g vercel` ثم `vercel login` ثم `vercel --prod`.

## الفكرة
- **الحصة** هي الأساس: طالب + مدرس + تاريخ وساعة ومدة + سعر الطالب + أجر المدرس. لو حصة اتلغت، احذفها.
- الأسعار الافتراضية بتتحط من بيانات الطالب والمدرس وتقدر تغيّرها لكل حصة.
- **جدول شهري**: بتختار الشهر وأيام الأسبوع والساعة، وبيتولّد كل الشهر مع منع تعارض المواعيد للمدرس أو الطالب.
- **الحسابات**: مستحق الشهر = مجموع حصص الشهر. الرصيد = إجمالي كل الحصص − الدفعات (تراكمي).
- **PDF + واتساب**: من كشف الحساب أو بعد إنشاء الجدول. واتساب العادي مبيسمحش بإرسال ملف تلقائيًا؛
  على الموبايل بتختار واتساب من المشاركة، وعلى الكمبيوتر الملف بيتحمّل وتفتح المحادثة وتضغط إرسال.

## API (كلها بتحتاج `Authorization: Bearer <token>` ما عدا الدخول)
`POST /api/auth/login` · `/api/students` · `/api/teachers` · `/api/sessions` (+ `POST /bulk` جدول شهري) · `/api/payments` ·
`GET /api/accounts?month=YYYY-MM` · `GET /api/dashboard` · `GET /api/statements/:student|teacher/:id?month=`
