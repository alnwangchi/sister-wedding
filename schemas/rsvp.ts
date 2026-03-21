import { z } from 'zod';

export const rsvpSchema = z
  .object({
    name: z.string().trim().min(1, '請輸入姓名').max(12, '姓名上限為 12 字'),
    phone: z.string().trim().min(1, '請輸入電話'),
    attending: z.enum(['yes', 'no'], {
      error: '請選擇是否參加',
    }),
    guestCount: z.coerce
      .number()
      .int('請輸入整數')
      .min(0, '人數不可小於 0')
      .max(10, '人數上限為 10'),
    email: z.email({ message: '請輸入有效的電子信箱' }),
    vegetarian: z
      .enum(['none', 'vegetarian', 'vegan', 'other'], {
        error: '請選擇吃素需求',
      })
      .nullable(),
    side: z.enum(['groom', 'bride'], {
      error: '請選擇男方或女方親友',
    }),
    message: z.string().trim().max(300, '想說的話請控制在 300 字內').default(''),
  })
  .superRefine((data, ctx) => {
    if (data.attending === 'yes' && data.guestCount < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['guestCount'],
        message: '若會出席，參加人數至少需為 1',
      });
    }

    if (data.attending === 'no' && data.guestCount !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['guestCount'],
        message: '若不出席，參加人數請填 0',
      });
    }

    if (data.attending === 'yes' && data.vegetarian === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['vegetarian'],
        message: '若會出席，請選擇吃素需求',
      });
    }

    if (data.attending === 'no' && data.vegetarian !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['vegetarian'],
        message: '若不出席，吃素需求請留空',
      });
    }
  });

export type RsvpFormInput = z.input<typeof rsvpSchema>;
export type RsvpFormValues = z.output<typeof rsvpSchema>;
