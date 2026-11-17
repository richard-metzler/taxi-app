import Image from "next/image";

/** Стартовый экран: логотип «РЯДОМ» и оранжевое такси на синем фоне. */
export function SplashScreen({ className = "" }: { className?: string }) {
  return (
    <div className={`flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#1E5FD6] ${className}`}>
      <Image
        src="/images/splash.png"
        alt="Рядом — такси"
        width={850}
        height={900}
        priority
        className="h-full max-h-dvh w-auto max-w-full object-contain"
      />
    </div>
  );
}
