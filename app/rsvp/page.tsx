import Link from 'next/link';

import { RsvpForm } from '@/components/rsvp-form';

export default function RsvpPage() {
  return (
    <main className='px-6 py-8 sm:px-8 lg:px-12'>
      <div className='mx-auto max-w-4xl'>
        <Link href='/' className='text-sm font-medium text-rose-500 transition hover:text-rose-600'>
          返回首頁
        </Link>

        <section className='mt-6 rounded-[2.5rem] border border-rose-100 bg-white/85 p-8 shadow-sm backdrop-blur md:p-10'>
          <h1 className=' text-3xl font-semibold text-stone-800 sm:text-4xl'>填寫婚禮出席回覆</h1>
          <p className='mt-2 text-sm text-stone-500 sm:text-base'>
            請協助填寫以下資訊，讓新人可以更順利安排喜宴人數、座位與電子喜帖寄送。
          </p>

          <div className='mt-2'>
            <RsvpForm />
          </div>
        </section>
      </div>
    </main>
  );
}
