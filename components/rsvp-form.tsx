"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  rsvpSchema,
  type RsvpFormInput,
  type RsvpFormValues,
} from "@/schemas/rsvp";
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
  needEDM: "yes",
};

export function RsvpForm() {
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

  useEffect(() => {
    if (attending === "no") {
      setValue("guestCount", 0, { shouldValidate: true });
      setValue("vegetarian", null, { shouldValidate: true });
    }

    if (attending === "yes") {
      setValue("guestCount", 1, { shouldValidate: true });
      setValue("vegetarian", "none", { shouldValidate: true });
    }
  }, [attending, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitState({ status: "idle", message: "" });

    const payload: RsvpFormValues = {
      ...values,
      vegetarian: values.attending === "no" ? null : values.vegetarian,
    };

    const response = await fetch("/api/rsvp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      setSubmitState({
        status: "error",
        message: result.message ?? "送出失敗，請稍後再試。",
      });
      return;
    }

    setSubmitState({
      status: "success",
      message: "已收到你的回覆，謝謝你的祝福與參與。",
    });
    reset(defaultValues);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Field label="姓名" error={errors.name?.message}>
        <input className={fieldClassName} placeholder="請輸入姓名" {...register("name")} />
      </Field>

      <Field label="電話" error={errors.phone?.message}>
        <input
          className={fieldClassName}
          placeholder="請輸入電話"
          inputMode="tel"
          {...register("phone")}
        />
      </Field>

      <Field label="是否參加" error={errors.attending?.message}>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={radioClassName}>
            <input type="radio" value="yes" {...register("attending")} />
            會參加
          </label>
          <label className={radioClassName}>
            <input type="radio" value="no" {...register("attending")} />
            無法參加
          </label>
        </div>
      </Field>

      <Field label="參加人數" error={errors.guestCount?.message}>
        <input
          className={fieldClassName}
          type="number"
          min={0}
          max={10}
          disabled={attending === "no"}
          {...register("guestCount")}
        />
      </Field>

      <Field label="電子信箱" error={errors.email?.message}>
        <input
          className={fieldClassName}
          type="email"
          placeholder="you@example.com"
          {...register("email")}
        />
      </Field>

      {attending === "yes" ? (
        <Field label="吃素需求" error={errors.vegetarian?.message}>
          <select className={fieldClassName} {...register("vegetarian")}>
            <option value="none">無</option>
            <option value="vegetarian">蛋奶素</option>
            <option value="vegan">全素</option>
            <option value="other">其他需求</option>
          </select>
        </Field>
      ) : null}

      <Field label="男方或女方親友" error={errors.side?.message}>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={radioClassName}>
            <input type="radio" value="groom" {...register("side")} />
            男方親友
          </label>
          <label className={radioClassName}>
            <input type="radio" value="bride" {...register("side")} />
            女方親友
          </label>
        </div>
      </Field>

      <Field label="想說的話" error={errors.message?.message}>
        <textarea
          className={`${fieldClassName} min-h-32 resize-y`}
          placeholder="留下祝福或想對新人說的話"
          {...register("message")}
        />
      </Field>

      <Field label="是否需要電子喜帖" error={errors.needEDM?.message}>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={radioClassName}>
            <input type="radio" value="yes" {...register("needEDM")} />
            需要
          </label>
          <label className={radioClassName}>
            <input type="radio" value="no" {...register("needEDM")} />
            不需要
          </label>
        </div>
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
        {isSubmitting ? "送出中..." : "送出回覆"}
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
