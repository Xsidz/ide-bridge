import type { ReactNode } from "react";

export default function ContributingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[780px] px-6 py-12 sm:px-8 sm:py-16">
      <div
        className={[
          "prose prose-invert max-w-none",
          "prose-headings:font-bold prose-headings:text-[#fdfcfc]",
          "prose-h1:text-[2.38rem] prose-h1:leading-[1.5]",
          "prose-h2:text-base prose-h2:leading-[1.5]",
          "prose-h3:text-sm prose-h3:leading-[1.5] prose-h3:uppercase prose-h3:tracking-widest prose-h3:text-[#9a9898]",
          "prose-p:text-[#9a9898] prose-p:leading-[1.5]",
          "prose-a:text-[#007aff] prose-a:no-underline hover:prose-a:underline",
          "prose-code:rounded-[4px] prose-code:bg-[#302c2c] prose-code:px-1 prose-code:py-0.5 prose-code:text-[#fdfcfc] prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:rounded-[4px] prose-pre:bg-[#302c2c] prose-pre:border prose-pre:border-[rgba(15,0,0,0.12)]",
          "prose-strong:text-[#fdfcfc]",
          "prose-table:text-sm",
          "prose-th:text-[#fdfcfc] prose-th:font-bold prose-th:border-b prose-th:border-[rgba(15,0,0,0.12)]",
          "prose-td:text-[#9a9898] prose-td:border-b prose-td:border-[rgba(15,0,0,0.12)]",
          "prose-hr:border-[rgba(15,0,0,0.12)]",
          "prose-blockquote:border-l-[#007aff] prose-blockquote:text-[#9a9898]",
          "prose-li:text-[#9a9898]",
        ].join(" ")}
      >
        {children}
      </div>
    </main>
  );
}
