import Image from 'next/image';
import Link from 'next/link';
import mainPhoto from '../assets/main.jpg';
import parkingCard1 from '../assets/2026 週邊停車場小卡.jpg';
import parkingCard2 from '../assets/2026 週邊停車場小卡2.jpg';

const details = [
  { label: '婚宴時間', value: '2026/07/19 18:00' },
  { label: '婚宴地點', value: '晶華酒店3F' },
  { label: '新人', value: '朱威𣽆&王姿婷' },
];

const cardFrame =
  'rounded-[2rem] border border-rose-100 shadow-[0_30px_120px_rgba(244,63,94,0.08)] backdrop-blur sm:rounded-[2.5rem]';
const cardShell = `${cardFrame} bg-white/80`;

export default function HomePage() {
  return (
    <main className='px-4 py-6 sm:px-8 sm:py-8 lg:px-12'>
      <section className='mx-auto grid min-h-[calc(100vh-3.5rem)] w-full max-w-6xl items-start gap-5 sm:gap-7 lg:min-h-[calc(100vh-4.5rem)] lg:grid-cols-[1.2fr_0.8fr] lg:gap-8'>
        <div className={`${cardFrame} bg-white/65 p-5 sm:p-8 lg:p-12`}>
          <div className='relative mb-6 overflow-hidden rounded-[1.5rem] sm:mb-8 sm:rounded-[2rem]'>
            <Image
              src={mainPhoto}
              alt='新人婚紗照'
              priority
              className='h-auto w-full object-cover'
            />
          </div>
          <p className='text-center text-xs font-semibold uppercase tracking-[0.28em] text-rose-400 sm:text-sm sm:tracking-[0.35em]'>
            Wedding Day 2026.07.19
          </p>
          <h1 className='mt-4 text-center text-3xl font-semibold tracking-tight text-stone-800 sm:mt-6 sm:text-5xl lg:text-6xl'>
            朱威𣽆
            <span className='mx-3 text-rose-400'> & </span>
            <span className='text-bride'>王姿婷</span>
          </h1>
          <p className='mt-4 max-w-2xl text-center whitespace-pre-line text-sm leading-7 text-stone-600 sm:mt-6 sm:text-base sm:leading-8 lg:text-lg'>
            在日常的流轉裡，我們決定牽起彼此的手
            {'\n'}
            走向人生的下一段旅程
            {'\n\n'}
            這一天，希望有你的見證與陪伴
          </p>

          <div className='mt-7 flex sm:mt-10'>
            <Link
              href='/rsvp'
              className='inline-flex w-full items-center justify-center rounded-full bg-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 w-full'
            >
              立即填寫回覆
            </Link>
          </div>
        </div>

        <div className='space-y-2 sm:space-y-3'>
          <div className={`${cardShell} p-5 sm:p-8`}>
            <p className='text-sm font-semibold text-rose-500'>婚禮資訊</p>
            <ul className='mt-5 space-y-2 sm:mt-6'>
              {details.map((detail) => (
                <li
                  key={detail.label}
                  className='rounded-3xl bg-rose-50/80 px-4 py-3 sm:px-5 sm:py-4'
                >
                  <p className='text-sm text-stone-400'>{detail.label}</p>
                  <p className='mt-1 text-sm font-medium text-stone-700 sm:text-base'>
                    {detail.value}
                  </p>
                </li>
              ))}
            </ul>
            <div className='mt-4 rounded-3xl bg-rose-50/80 px-4 py-3 sm:mt-5 sm:px-5 sm:py-4'>
              <p className='text-sm text-stone-400'>婚禮時間</p>
              <p className='mt-1 whitespace-pre-line text-sm font-medium leading-7 text-stone-700 sm:text-base sm:leading-8'>
                證婚
                <br /> 16:30 入席 16:45 開始{'\n'}
                晚宴
                <br /> 18:00 迎賓 18:30 開席
              </p>
            </div>
            <p className='mt-4 rounded-3xl border border-rose-100/80 bg-white/60 px-4 py-3 text-sm leading-7 text-stone-600 sm:mt-5 sm:px-5 sm:py-4 sm:text-base sm:leading-8'>
              因場地安排考量，僅限定七歲以上孩童參與，不便之處還請見諒。
            </p>
          </div>

          <div
            className={`${cardFrame} bg-[linear-gradient(135deg,#fff1f2_0%,#fff8f5_100%)] p-5 sm:p-8`}
          >
            <p className='text-sm font-semibold text-rose-500'>給親友的話</p>
            <p className='mt-4 whitespace-pre-line text-sm leading-7 text-stone-600 sm:text-base sm:leading-8'>
              為了讓一切安排更加周到，
              {'\n'}
              邀請你填寫婚禮出席表單，讓我們為你預留一席溫暖的位置。
              {'\n\n'}
              謝謝你，出現在我們重要的時刻
            </p>
          </div>

          <div className={`${cardShell} p-5 sm:p-8`}>
            <div className='flex items-center justify-between gap-4'>
              <p className='text-sm font-semibold text-rose-500'>停車卡</p>
              <a
                href='/parking-card'
                target='_blank'
                rel='noreferrer'
                className='text-xs font-medium text-rose-500 transition hover:text-rose-600'
              >
                另開頁面查看
              </a>
            </div>
            <p className='mt-4 text-sm leading-7 text-stone-600'>
              下方為預覽；點擊右上角可另開頁面放大檢視。
            </p>
            <div className='mt-4 space-y-3'>
              <div className='mx-auto max-w-[200px] overflow-hidden rounded-xl border border-rose-100 bg-white sm:max-w-[240px]'>
                <Image
                  src={parkingCard1}
                  alt='2026 週邊停車場小卡'
                  className='h-auto w-full'
                  sizes='(max-width: 640px) 200px, 240px'
                />
              </div>
              <div className='mx-auto max-w-[200px] overflow-hidden rounded-xl border border-rose-100 bg-white sm:max-w-[240px]'>
                <Image
                  src={parkingCard2}
                  alt='2026 週邊停車場小卡（二）'
                  className='h-auto w-full'
                  sizes='(max-width: 640px) 200px, 240px'
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
