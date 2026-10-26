import type { ReactNode } from "react";

/** Cadre commun aux pages /connexion et /inscription. */
export default function LayoutAuth({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
