import Link from "next/link";

import { RsvpConfirmation } from "@/components/rsvp-confirmation";

export default function RsvpConfirmPage() {
  return (
    <main className="px-6 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-medium text-rose-500 transition hover:text-rose-600">
          返回首頁
        </Link>

        <section className="mt-6 rounded-[2.5rem] border border-rose-100 bg-white/85 p-8 shadow-sm backdrop-blur md:p-10">
          <p className="text-sm font-semibold text-rose-500">RSVP 確認頁</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-800 sm:text-4xl">
            請再次確認回覆內容
          </h1>
          <p className="mt-4 text-sm leading-7 text-stone-500 sm:text-base">
            確認資料無誤後再送出。若需要修改，可按下「回上一頁」返回表單調整。
          </p>

          <div className="mt-10">
            <RsvpConfirmation />
          </div>
        </section>
      </div>
    </main>
  );
}
