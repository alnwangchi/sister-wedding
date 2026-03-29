"use client";

import dynamic from "next/dynamic";

const Player = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false },
);

const DEFAULT_LOTTIE_SRC = "https://assets9.lottiefiles.com/packages/lf20_obhph3sh.json";

export function RsvpFormHeroAnimation() {
  return (
    <Player
      autoplay
      loop
      keepLastFrame
      src={DEFAULT_LOTTIE_SRC}
      className="h-40 w-full drop-shadow-[0_8px_20px_rgba(244,63,94,0.18)] sm:h-44"
    />
  );
}
