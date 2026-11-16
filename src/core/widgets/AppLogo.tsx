import Image from "next/image";

/**
 * Логотип «Рядом»: оранжевая «Р» с концентрическими дугами и тёмно-синее «ЯДОМ».
 * Исходник — public/images/logo.webp (прозрачный фон, сжатая версия присланного PNG).
 */
export function AppLogo({ className = "h-auto w-64 max-w-full" }: { className?: string }) {
  return (
    <Image
      src="/images/logo.webp"
      alt="Рядом"
      width={900}
      height={472}
      className={className}
      draggable={false}
    />
  );
}
