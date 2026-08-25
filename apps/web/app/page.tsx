import Link from "next/link";

export default function Home() {
  return (
    <section className='flex flex-1 flex-col justify-center gap-8 py-10'>
      <div className='max-w-2xl'>
        <h1 className='font-display text-4xl font-semibold leading-tight tracking-tight text-accent-ink sm:text-5xl'>
          Spec Hub
        </h1>
        <p className='mt-4 max-w-xl text-lg leading-relaxed text-muted'>
          مشخصات تغییرات نرم‌افزاری را ساخت‌یافته بنویسید تا ایجنت‌های توسعه،
          مأموریت، شعاع اثر، قراردادها و معیارهای پذیرش Gherkin را شفاف دریافت
          کنند — سپس در BookStack منتشر کنید.
        </p>
        <div className='mt-8 flex flex-wrap gap-3'>
          <Link
            href='/specs/new'
            className='rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-ink'
          >
            نگارش مشخصات
          </Link>
        </div>
      </div>
    </section>
  );
}
