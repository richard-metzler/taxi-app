import Image from "next/image";

/** Знак «Р» из логотипа «Рядом» (оранжевая буква с концентрическими дугами). */
export function BrandMark({ className = "h-12 w-12 shrink-0" }: { className?: string }) {
  return (
    <Image
      src="/images/logo-mark.png"
      alt="Рядом"
      width={180}
      height={180}
      className={className}
      draggable={false}
    />
  );
}
