"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";

import {
  rsvpSchema,
  type RsvpFormInput,
  type RsvpFormValues,
} from "@/schemas/rsvp";
import { RSVP_DRAFT_STORAGE_KEY } from "@/lib/rsvp-draft";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fieldClassName =
  "mt-2 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100";

const radioClassName =
  "flex cursor-pointer items-start gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-rose-300 [&>input]:mt-0.5 [&>input]:shrink-0";

const defaultValues: RsvpFormInput = {
  name: "",
  phone: "",
  attending: "yes",
  guestCount: 1,
  email: "",
  vegetarian: "none",
  side: "groom",
  relationshipTag: "friend",
  needsPaperInvitation: "no",
  mailingAddress: "",
  message: "",
};

const formVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const fieldVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -20,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export function RsvpForm() {
  const router = useRouter();
  const [submitState, setSubmitState] = useState<{
    status: "idle" | "success" | "error";
    message: string;
  }>({
    status: "idle",
    message: "",
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RsvpFormInput, undefined, RsvpFormValues>({
    resolver: zodResolver(rsvpSchema),
    defaultValues,
  });

  const attending = useWatch({
    control,
    name: "attending",
  });
  const needsPaperInvitation = useWatch({
    control,
    name: "needsPaperInvitation",
  });
  const previousAttending = useRef<RsvpFormInput["attending"] | null>(null);

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(RSVP_DRAFT_STORAGE_KEY);

      if (!rawDraft) {
        return;
      }

      const parsedDraft = rsvpSchema.safeParse(JSON.parse(rawDraft));

      if (parsedDraft.success) {
        reset(parsedDraft.data);
      }
    } catch {
      window.sessionStorage.removeItem(RSVP_DRAFT_STORAGE_KEY);
    }
  }, [reset]);

  useEffect(() => {
    if (attending === "no") {
      setValue("guestCount", 0, { shouldValidate: true });
      setValue("vegetarian", null, { shouldValidate: true });
    }

    if (attending === "yes" && previousAttending.current === "no") {
      setValue("guestCount", 1, { shouldValidate: true });
      setValue("vegetarian", "none", { shouldValidate: true });
    }

    previousAttending.current = attending;
  }, [attending, setValue]);

  useEffect(() => {
    if (needsPaperInvitation === "no") {
      setValue("mailingAddress", "", { shouldValidate: true });
    }
  }, [needsPaperInvitation, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const payload: RsvpFormValues = {
      ...values,
      vegetarian: values.attending === "no" ? null : values.vegetarian,
      mailingAddress: values.needsPaperInvitation === "yes" ? values.mailingAddress : "",
    };
    setSubmitState({ status: "idle", message: "" });

    try {
      window.sessionStorage.setItem(RSVP_DRAFT_STORAGE_KEY, JSON.stringify(payload));
      router.push("/rsvp/confirm");
    } catch {
      setSubmitState({
        status: "error",
        message: "暫存確認資料失敗，請重新嘗試。",
      });
    }
  });

  return (
    <motion.form
      onSubmit={onSubmit}
      className="space-y-3"
      suppressHydrationWarning
      variants={formVariants}
      initial="hidden"
      animate="show"
    >
      <Field label="姓名" error={errors.name?.message}>
        <input
          className={fieldClassName}
          placeholder="請輸入姓名"
          suppressHydrationWarning
          {...register("name")}
        />
      </Field>

      <Field label="電話" error={errors.phone?.message}>
        <input
          className={fieldClassName}
          placeholder="請輸入電話"
          inputMode="tel"
          suppressHydrationWarning
          {...register("phone")}
        />
      </Field>

      <Field label="是否參加" error={errors.attending?.message}>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className={radioClassName}>
            <input type="radio" value="yes" suppressHydrationWarning {...register("attending")} />
            <span className="whitespace-normal break-words leading-5">會參加</span>
          </label>
          <label className={radioClassName}>
            <input type="radio" value="no" suppressHydrationWarning {...register("attending")} />
            <span className="whitespace-normal break-words leading-5">無法參加</span>
          </label>
        </div>
      </Field>

      {attending === "yes" ? (
        <Field label="參加人數" error={errors.guestCount?.message}>
          <input
            className={fieldClassName}
            type="number"
            min={0}
            max={10}
            suppressHydrationWarning
            {...register("guestCount")}
          />
        </Field>
      ) : null}

      <Field label="電子信箱" error={errors.email?.message}>
        <input
          className={fieldClassName}
          type="email"
          placeholder="you@example.com"
          suppressHydrationWarning
          {...register("email")}
        />
      </Field>

      {attending === "yes" ? (
        <Field label="吃素需求" error={errors.vegetarian?.message}>
          <Controller
            control={control}
            name="vegetarian"
            render={({ field }) => (
              <Select
                value={field.value ?? undefined}
                onValueChange={field.onChange}
                disabled={isSubmitting}
              >
                <SelectTrigger suppressHydrationWarning>
                  <SelectValue placeholder="請選擇吃素需求" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">無</SelectItem>
                  <SelectItem value="vegetarian">蛋奶素</SelectItem>
                  <SelectItem value="vegan">全素</SelectItem>
                  <SelectItem value="other">其他需求</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      ) : null}

      <Field label="男方或女方親友" error={errors.side?.message}>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className={radioClassName}>
            <input type="radio" value="groom" suppressHydrationWarning {...register("side")} />
            <span className="whitespace-normal break-words leading-5">男方親友</span>
          </label>
          <label className={radioClassName}>
            <input type="radio" value="bride" suppressHydrationWarning {...register("side")} />
            <span className="whitespace-normal break-words leading-5">女方親友</span>
          </label>
        </div>
      </Field>

      <Field label="關係標籤" error={errors.relationshipTag?.message}>
        <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={radioClassName}>
            <input
              type="radio"
              value="classmate"
              suppressHydrationWarning
              {...register("relationshipTag")}
            />
            <span className="whitespace-normal break-words leading-5">同學</span>
          </label>
          <label className={radioClassName}>
            <input
              type="radio"
              value="colleague"
              suppressHydrationWarning
              {...register("relationshipTag")}
            />
            <span className="whitespace-normal break-words leading-5">同事</span>
          </label>
          <label className={radioClassName}>
            <input
              type="radio"
              value="friend"
              suppressHydrationWarning
              {...register("relationshipTag")}
            />
            <span className="whitespace-normal break-words leading-5">朋友</span>
          </label>
          <label className={radioClassName}>
            <input
              type="radio"
              value="relative"
              suppressHydrationWarning
              {...register("relationshipTag")}
            />
            <span className="whitespace-normal break-words leading-5">親戚</span>
          </label>
        </div>
      </Field>

      <Field label="是否單身（選填）" error={errors.isSingle?.message}>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className={radioClassName}>
            <input type="radio" value="yes" suppressHydrationWarning {...register("isSingle")} />
            <span className="whitespace-normal break-words leading-5">是</span>
          </label>
          <label className={radioClassName}>
            <input type="radio" value="no" suppressHydrationWarning {...register("isSingle")} />
            <span className="whitespace-normal break-words leading-5">否</span>
          </label>
        </div>
      </Field>

      <Field label="是否需要紙本喜帖" error={errors.needsPaperInvitation?.message}>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className={radioClassName}>
            <input
              type="radio"
              value="yes"
              suppressHydrationWarning
              {...register("needsPaperInvitation")}
            />
            <span className="whitespace-normal break-words leading-5">需要</span>
          </label>
          <label className={radioClassName}>
            <input
              type="radio"
              value="no"
              suppressHydrationWarning
              {...register("needsPaperInvitation")}
            />
            <span className="whitespace-normal break-words leading-5">不需要</span>
          </label>
        </div>
      </Field>

      {needsPaperInvitation === "yes" ? (
        <Field label="收件地址" error={errors.mailingAddress?.message}>
          <textarea
            className={`${fieldClassName} min-h-24 resize-y`}
            placeholder="請輸入可收件地址"
            suppressHydrationWarning
            {...register("mailingAddress")}
          />
        </Field>
      ) : null}

      <Field label="想說的話" error={errors.message?.message}>
        <textarea
          className={`${fieldClassName} min-h-32 resize-y`}
          placeholder="留下祝福或想對新人說的話"
          suppressHydrationWarning
          {...register("message")}
        />
      </Field>

      {submitState.message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            submitState.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {submitState.message}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-auto w-full rounded-full px-6 py-3 disabled:bg-rose-300"
      >
        {isSubmitting ? "處理中..." : "前往確認頁"}
      </Button>
    </motion.form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <motion.label className="block" variants={fieldVariants}>
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      {children}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </motion.label>
  );
}
