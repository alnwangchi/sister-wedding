"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import {
  rsvpSchema,
  type RsvpFormInput,
  type RsvpFormValues,
} from "@/schemas/rsvp";
import { RSVP_DRAFT_STORAGE_KEY } from "@/lib/rsvp-draft";
import { Button } from "@/components/ui/button";

const fieldClassName =
  "mt-2 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100";

const radioClassName =
  "flex cursor-pointer items-center gap-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-rose-300";

const defaultValues: RsvpFormInput = {
  name: "",
  phone: "",
  attending: "yes",
  guestCount: 1,
  email: "",
  vegetarian: "none",
  side: "groom",
  message: "",
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

  const onSubmit = handleSubmit(async (values) => {
    const payload: RsvpFormValues = {
      ...values,
      vegetarian: values.attending === "no" ? null : values.vegetarian,
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
    <form onSubmit={onSubmit} className="space-y-3" suppressHydrationWarning>
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
            會參加
          </label>
          <label className={radioClassName}>
            <input type="radio" value="no" suppressHydrationWarning {...register("attending")} />
            無法參加
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
          <select className={fieldClassName} suppressHydrationWarning {...register("vegetarian")}>
            <option value="none">無</option>
            <option value="vegetarian">蛋奶素</option>
            <option value="vegan">全素</option>
            <option value="other">其他需求</option>
          </select>
        </Field>
      ) : null}

      <Field label="男方或女方親友" error={errors.side?.message}>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className={radioClassName}>
            <input type="radio" value="groom" suppressHydrationWarning {...register("side")} />
            男方親友
          </label>
          <label className={radioClassName}>
            <input type="radio" value="bride" suppressHydrationWarning {...register("side")} />
            女方親友
          </label>
        </div>
      </Field>

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
    </form>
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
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      {children}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </label>
  );
}
