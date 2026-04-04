"use client";

import { Toaster as Sonner } from "sonner";

import type { ComponentProps } from "react";

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-rose-100 group-[.toaster]:bg-white group-[.toaster]:text-stone-700 group-[.toaster]:shadow-lg",
          title: "text-sm font-medium text-stone-800",
          description: "text-sm text-stone-500",
          success: "group-[.toaster]:border-emerald-100",
        },
      }}
      {...props}
    />
  );
}
