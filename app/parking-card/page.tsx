import Image from "next/image";
import Link from "next/link";

import parkingCard1 from "../../assets/2026 週邊停車場小卡.jpg";
import parkingCard2 from "../../assets/2026 週邊停車場小卡2.jpg";

export default function ParkingCardPage() {
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      <section className="mx-auto w-full max-w-4xl rounded-[2rem] border border-rose-100 bg-white/80 p-5 shadow-sm backdrop-blur sm:rounded-[2.5rem] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-stone-800 sm:text-2xl">
            婚禮停車卡
          </h1>
          <Link
            href="/"
            className="text-sm font-medium text-stone-500 transition hover:text-stone-700"
          >
            回到首頁
          </Link>
        </div>

        <div className="mt-5 space-y-5">
          <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white">
            <Image
              src={parkingCard1}
              alt="2026 週邊停車場小卡"
              priority
              className="h-auto w-full"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white">
            <Image
              src={parkingCard2}
              alt="2026 週邊停車場小卡（二）"
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
