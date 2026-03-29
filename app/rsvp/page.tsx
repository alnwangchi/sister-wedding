import dynamic from 'next/dynamic';
import Link from 'next/link';

import { RsvpForm } from '@/components/rsvp-form';

const RsvpFormHeroAnimation = dynamic(
  () => import('@/components/rsvp-form-hero-animation').then((mod) => mod.RsvpFormHeroAnimation),
  { ssr: false },
);

export default function RsvpPage() {
  return (
    <main className='px-6 py-8 sm:px-8 lg:px-12'>
      <div className='mx-auto max-w-4xl'>
        <Link href='/' className='text-sm font-medium text-rose-500 transition hover:text-rose-600'>
          返回首頁
        </Link>

        <section className='mt-6 rounded-[2.5rem] border border-rose-100 bg-white/85 p-8 shadow-sm backdrop-blur md:p-10'>
          <div className='relative overflow-hidden rounded-3xl bg-rose-50/55 px-4 py-5 sm:hidden'>
            <div className='pointer-events-none absolute inset-x-0 -top-6 z-0 mx-auto w-48 opacity-30'>
              <RsvpFormHeroAnimation />
            </div>
            <div className='relative z-10'>
              <h1 className='text-3xl font-semibold text-stone-800'>
                威𣽆 & 姿婷婚禮表單
              </h1>
              <p className='mt-2 text-sm text-stone-500'>
                請協助填寫以下資訊，讓我們可以更順利安排喜宴人數與座位。
              </p>
            </div>
          </div>

          <div className='hidden sm:flex sm:items-center sm:gap-4'>
            <div className='w-full max-w-[11rem] shrink-0'>
              <RsvpFormHeroAnimation />
            </div>
            <div>
              <h1 className='text-3xl font-semibold text-stone-800 sm:text-4xl'>
                威𣽆 & 姿婷婚禮表單
              </h1>
              <p className='mt-2 text-sm text-stone-500 sm:text-base'>
                請協助填寫以下資訊，讓我們可以更順利安排喜宴人數與座位。
              </p>
            </div>
          </div>

          <div className='mt-4'>
            <RsvpForm />
          </div>
        </section>
      </div>
    </main>
  );
}
