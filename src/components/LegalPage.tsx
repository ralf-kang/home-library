import { PublicHeader, SiteFooter } from '@/components/SiteChrome'

/** 약관·개인정보처리방침·요금 안내 같은 공개 문서 틀. */
export default function LegalPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-bold">{title}</h1>
        {updated && <p className="mt-2 text-sm text-muted">시행일·최종 수정: {updated}</p>}
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:bg-paper [&_th]:p-2 [&_th]:text-left">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
