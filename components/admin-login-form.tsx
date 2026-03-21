'use client';

import { type FormEventHandler, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const SIMPLE_ADMIN_PASSWORD = '0610';

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (password !== SIMPLE_ADMIN_PASSWORD) {
      setError('管理密碼錯誤。');
      return;
    }

    setError('');
    router.replace('/admin');
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='rounded-[2rem] border border-rose-100 bg-white p-8 shadow-sm'
    >
      <p className='text-sm font-semibold text-rose-500'>新人專用後台</p>
      <h1 className='mt-2 text-3xl font-semibold text-stone-800'>登入管理頁面</h1>
      <p className='mt-3 text-sm leading-7 text-stone-500'>請輸入管理密碼登入後台。</p>

      <label className='mt-8 block'>
        <span className='text-sm font-semibold text-stone-700'>管理密碼</span>
        <input
          type='password'
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          inputMode='numeric'
          autoCapitalize='off'
          autoCorrect='off'
          className='mt-2 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100'
          placeholder='請輸入管理密碼'
          required
        />
      </label>

      {error ? (
        <p className='mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600'>{error}</p>
      ) : null}

      <Button asChild variant='outline' className='h-auto rounded-full px-6 py-3'>
        <Link href='/admin'>新人後台</Link>
      </Button>
      <Button
        type='submit'
        variant='secondary'
        className='mt-6 h-auto w-full rounded-full px-6 py-3 disabled:bg-stone-400'
      >
        登入後台
      </Button>
    </form>
  );
}
