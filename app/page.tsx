import Link from "next/link";

const details = [
  { label: "婚宴日期", value: "2026 / 12 / 20（日）" },
  { label: "婚宴時間", value: "17:30 入席，18:00 開宴" },
  { label: "婚宴地點", value: "台北晶華酒店 3F 宴會廳" },
  { label: "交通提醒", value: "捷運中山站步行約 8 分鐘，可使用飯店停車場" },
];

export default function HomePage() {
  return (
    <main className="px-6 py-8 sm:px-8 lg:px-12">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2.5rem] border border-white/60 bg-white/65 p-8 shadow-[0_30px_120px_rgba(244,63,94,0.08)] backdrop-blur md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-rose-400">Wedding Day</p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-stone-800 sm:text-6xl">
            Allen
            <span className="mx-3 text-rose-400">&</span>
            Jamie
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
            誠摯邀請你一同見證我們的重要時刻。網站提供婚禮資訊與線上 RSVP 回覆，方便親友快速填寫出席意願與需求。
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/rsvp"
              className="inline-flex items-center justify-center rounded-full bg-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
            >
              立即填寫回覆
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-white px-6 py-3 text-sm font-semibold text-stone-700 transition hover:border-rose-400 hover:text-rose-500"
            >
              新人後台
            </Link>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2.5rem] border border-rose-100 bg-white/80 p-8 shadow-sm backdrop-blur">
            <p className="text-sm font-semibold text-rose-500">婚禮資訊</p>
            <ul className="mt-6 space-y-4">
              {details.map((detail) => (
                <li key={detail.label} className="rounded-3xl bg-rose-50/80 px-5 py-4">
                  <p className="text-sm text-stone-400">{detail.label}</p>
                  <p className="mt-1 text-base font-medium text-stone-700">{detail.value}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[2.5rem] border border-rose-100 bg-[linear-gradient(135deg,#fff1f2_0%,#fff8f5_100%)] p-8 shadow-sm">
            <p className="text-sm font-semibold text-rose-500">給親友的話</p>
            <p className="mt-4 text-base leading-8 text-stone-600">
              很期待在這個特別的日子與你相聚。若能提前收到你的出席回覆，我們就能更妥善安排婚宴座位與喜帖資訊，謝謝你。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
