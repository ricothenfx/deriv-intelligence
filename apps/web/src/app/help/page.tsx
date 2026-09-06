"use client";

import { Card } from "@/components/ui";
import { GLOSSARY, HELP } from "@/lib/help";

export default function HelpPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Panduan &amp; Glossary</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Penjelasan semua istilah dan metrik yang dipakai di dashboard ini. Tooltip (?) di setiap judul kartu/angka juga menampilkan penjelasan singkat.
        </p>
      </div>

      <Card title="Cara kerja aplikasi ini (big picture)">
        <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-slate-300">
          <li>
            <span className="font-medium text-slate-100">Grab</span> — worker mengambil data mentah dari 4 channel: Reddit, YouTube, Google Play, dan web/news (Tavily), terjadwal otomatis (Reddit tiap 15 menit; YouTube &amp; Google Play tiap jam; web tiap 6 jam) atau manual lewat tombol “Grab now” di halaman Overview.
          </li>
          <li>
            <span className="font-medium text-slate-100">Enrich</span> — setiap postingan dianalisis AI: sentimen, emosi, aspek keluhan, topik, tahap journey user, perkiraan negara, dan deteksi bot. {HELP.enrichment}
          </li>
          <li>
            <span className="font-medium text-slate-100">Analyze</span> — angka-angka di semua halaman adalah agregasi SQL dari data tersebut, selalu memakai bobot engagement dan mengeluarkan postingan bot. {HELP.bot_filter}
          </li>
          <li>
            <span className="font-medium text-slate-100">Verifikasi</span> — hampir semua kutipan postingan punya tautan “buka sumber” yang membuka halaman aslinya di tab baru, sehingga Anda bisa memeriksa dan langsung membalas di platform sumbernya.
          </li>
        </ol>
      </Card>

      {GLOSSARY.map((section) => (
        <Card key={section.section} title={section.section}>
          <dl className="space-y-3">
            {section.entries.map((e) => (
              <div key={e.term}>
                <dt className="text-xs font-semibold text-slate-200">{e.term}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-slate-400">{e.definition}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}
