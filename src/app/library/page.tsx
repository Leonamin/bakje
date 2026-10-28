import Link from "next/link";
import { LibraryManager } from "@/components/library-manager";
import { storages } from "@/lib/library-files";
import { listRuns } from "@/lib/library-import";
import { analysisStatus } from "@/lib/analysis-jobs";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function LibraryManagementPage() {
  return <div className="mx-auto max-w-3xl px-5 pb-16 pt-6 md:pt-10"><Link href="/" className="press label">← 라이브러리</Link><h1 className="mb-6 mt-4 text-[24px] font-bold tracking-tight">폴더와 작업</h1>
    <LibraryManager initial={{ storages: storages(), runs: listRuns(), analysis: analysisStatus(), bulk_paused: !!db().prepare("SELECT 1 FROM setting WHERE key='library.bulk_paused' AND value='1'").get() }} />
  </div>;
}
