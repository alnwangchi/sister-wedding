"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { RSVP_DRAFT_STORAGE_KEY } from "@/lib/rsvp-draft";
import { Button } from "@/components/ui/button";
import { rsvpSchema, type RsvpFormValues } from "@/schemas/rsvp";

type ConfirmationStatus = "loading" | "ready" | "submitting" | "success" | "error";

const attendingLabels = {
  yes: "會參加",
  no: "無法參加",
} as const;

const vegetarianLabels = {
  none: "無",
  vegetarian: "蛋奶素",
  vegan: "全素",
  other: "其他需求",
} as const;

const sideLabels = {
  groom: "男方親友",
  bride: "女方親友",
} as const;

const relationshipTagLabels = {
  classmate: "同學",
  colleague: "同事",
  friend: "朋友",
} as const;

export function RsvpConfirmation() {
  const router = useRouter();
  const [draft, setDraft] = useState<RsvpFormValues | null>(null);
  const [status, setStatus] = useState<ConfirmationStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(RSVP_DRAFT_STORAGE_KEY);

      if (!rawDraft) {
        setStatus("error");
        setMessage("找不到待確認資料，請先填寫 RSVP 表單。");
        return;
      }

      const parsedDraft = rsvpSchema.safeParse(JSON.parse(rawDraft));

      if (!parsedDraft.success) {
        window.sessionStorage.removeItem(RSVP_DRAFT_STORAGE_KEY);
        setStatus("error");
        setMessage("確認資料已失效，請重新填寫表單。");
        return;
      }

      setDraft(parsedDraft.data);
      setStatus("ready");
    } catch {
      window.sessionStorage.removeItem(RSVP_DRAFT_STORAGE_KEY);
      setStatus("error");
      setMessage("確認資料讀取失敗，請重新填寫表單。");
    }
  }, []);

  const handleConfirmSubmit = async () => {
    if (!draft) {
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(result.message ?? "送出失敗，請稍後再試。");
        return;
      }

      window.sessionStorage.removeItem(RSVP_DRAFT_STORAGE_KEY);
      setStatus("success");
      setMessage("已收到你的回覆，謝謝你的祝福與參與。");
    } catch {
      setStatus("error");
      setMessage("送出失敗，請確認網路連線後再試。");
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/rsvp");
  };

  if (status === "loading") {
    return <p className="text-sm text-stone-500">載入確認資料中...</p>;
  }

  if (status === "error" && !draft) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p>
        <Button asChild variant="outline" className="h-auto rounded-full px-6 py-3">
          <Link href="/rsvp">返回 RSVP 表單</Link>
        </Button>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-6 py-10 text-center">
        <p className="text-lg font-semibold text-emerald-700">已收到您的回覆，謝謝您的祝福與參與。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {draft ? (
        <div className="overflow-hidden rounded-3xl border border-rose-100 bg-white">
          <Field label="姓名" value={draft.name} />
          <Field label="電話" value={draft.phone} />
          <Field label="是否參加" value={attendingLabels[draft.attending]} />
          <Field label="參加人數" value={String(draft.guestCount)} />
          <Field label="電子信箱" value={draft.email} />
          <Field
            label="吃素需求"
            value={draft.attending === "no" ? "不適用" : vegetarianLabels[draft.vegetarian ?? "none"]}
          />
          <Field label="男方或女方親友" value={sideLabels[draft.side]} />
          <Field label="關係標籤" value={relationshipTagLabels[draft.relationshipTag]} />
          <Field label="想說的話" value={draft.message || "（未填寫）"} isLast />
        </div>
      ) : null}

      {message ? (
        <p
          className={`rounded-2xl px-4 py-3 text-sm ${
            status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={handleGoBack}
          disabled={status === "submitting"}
          className="h-auto flex-1 rounded-full px-6 py-3"
        >
          回上一頁
        </Button>
        <Button
          type="button"
          onClick={handleConfirmSubmit}
          disabled={status === "submitting"}
          className="h-auto flex-1 rounded-full px-6 py-3 disabled:bg-rose-300"
        >
          {status === "submitting" ? "送出中..." : "確認送出"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div className={`grid gap-2 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4 ${isLast ? "" : "border-b border-rose-100"}`}>
      <p className="text-sm font-semibold text-stone-600">{label}</p>
      <p className="text-sm leading-7 text-stone-700">{value}</p>
    </div>
  );
}
