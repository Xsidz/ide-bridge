import type { ReactNode } from "react";
import { DocsSidebar } from "./_components/DocsSidebar";
import { Breadcrumbs } from "./_components/Breadcrumbs";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <DocsSidebar />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Breadcrumb bar */}
        <header className="border-b border-[rgba(15,0,0,0.12)] px-4 py-4 sm:px-8">
          <Breadcrumbs />
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-[780px] flex-1 px-4 py-8 sm:px-8 sm:py-10">
          <div
            className={[
              "prose prose-invert max-w-none",
              "prose-headings:font-bold prose-headings:text-[#fdfcfc]",
              "prose-h1:text-[2.38rem] prose-h1:leading-[1.5]",
              "prose-h2:text-base prose-h2:leading-[1.5]",
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
      </div>
    </div>
  );
}
