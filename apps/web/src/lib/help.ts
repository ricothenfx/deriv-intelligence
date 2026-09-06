export const HELP = {
  mentions:
    "Jumlah total postingan/komentar/review tentang Deriv yang berhasil dikumpulkan dari semua channel (Reddit, YouTube, Google Play, web) dalam periode terpilih. Angka membandingkan dengan periode sebelumnya yang sama panjang.",
  weighted_sentiment:
    "Rata-rata sentimen dari -1 (sangat negatif) sampai +1 (sangat positif), dibobot oleh engagement — postingan dengan banyak views/likes/komentar berpengaruh lebih besar daripada postingan sepi.",
  negative_share:
    "Persentase mention yang diklasifikasi AI sebagai negatif. Rinciannya: jumlah negatif, positif, dan mixed (positif+negatif sekaligus).",
  countries_tracked:
    "Jumlah negara yang terdeteksi dari data. Lokasi diduga dari negara Google Play review (pasti), bahasa, subreddit, dan domain website — selalu dengan skor confidence.",
  open_alerts:
    "Anomali aktif yang terdeteksi otomatis (lonjakan keluhan atau penurunan sentimen yang tidak wajar). Klik untuk melihat detail dan timeline insiden.",
  volume_sentiment:
    "Grafik garis: volume = jumlah mention per hari (batang), sentimen = rata-rata tertimbang per hari (garis). Warna merah = negatif, hijau = positif.",
  sentiment_by_country:
    "Peringkat negara berdasarkan jumlah mention. Angka pertama = sentimen tertimbang (-1..+1), angka kedua = jumlah mention. Klik negara untuk halaman detail peta.",
  sentiment_by_platform:
    "Dari channel mana mention berasal (reddit/youtube/gplay/tavily) dan bagaimana sentimennya per channel.",
  topics_table:
    "Topik yang paling banyak dibahas dalam 7 hari terakhir. Share = porsi dari total mention; sentimen = rata-rata tertimbang topik itu. Klik baris untuk melihat tren dan contoh mention.",
  journey_funnel:
    "Tahap perjalanan user yang disimpulkan AI dari isi postingan: signup → KYC → deposit → trading → withdrawal → support. Bar = jumlah mention per tahap; angka = sentimen rata-rata tahap itu. Tahap paling merah = titik paling bermasalah.",
  dominant_negative_aspects:
    "Aspek produk yang paling sering dikeluhkan (mis. 'withdrawal delay', 'kyc'), dilengkapi tahap journey tempat keluhan itu muncul.",
  emerging_topics:
    "Topik yang pembahasannya naik signifikan minggu ini dibanding minggu sebelumnya — sinyal dini isu yang sedang membesar.",
  hourly_pattern:
    "Jam lokal pengguna (bukan jam server) ketika postingan dibuat. Pola keluhan tengah malam biasanya menandakan masalah layanan yang mendesak.",
  evidence:
    "Kutipan postingan asli berdampak tertinggi (sentimen × engagement). Klik tautan sumber untuk membuka postingan aslinya di tab baru dan memverifikasi/membalas langsung.",
  data_sources:
    "Status pengambilan data per channel: kapan terakhir kali data di-grab, jadwal otomatis (cron), dan tombol untuk mengambil data terbaru sekarang tanpa menunggu jadwal.",
  last_grab: "Waktu terakhir kali worker berhasil mengambil data dari channel ini (dari tabel query_state).",
  grab_now:
    "Ambil data terbaru dari channel ini sekarang juga. Job dikirim ke queue worker — data baru muncul beberapa saat setelah selesai (proses AI enrichment berjalan setelahnya).",
  grab_all: "Ambil data terbaru dari SEMUA channel sekaligus sekarang juga.",
  map_country:
    "Peta dunia: warna = sentimen (merah negatif, hijau positif), intensitas = jumlah mention. Klik negara untuk melihat rincian.",
  latest_mentions: "Postingan terbaru dari negara terpilih. Tautan sumber membuka postingan asli di tab baru.",
  funnel_aspect: "Tabel silang: aspek keluhan apa yang dominan di setiap tahap journey user.",
  alerts_zscore:
    "z-score = seberapa jauh nilai sekarang menyimpang dari rata-rata normal (dalam satuan simpangan baku). Di atas ~3 berarti anomadi statistik yang nyata.",
  alerts_baseline: "baseline = nilai normal rata-rata; observed = nilai yang terjadi pada window 2 jam terakhir.",
  alerts_confidence: "Seberapa yakin detektor bahwa ini anomali sungguhan (bukan fluktuasi acak).",
  alerts_timeline: "Kronologi kejadian anomali: kapan terdeteksi, kapan dikonfirmasi, dan bagaimana perkembangannya.",
  share_of_voice: "Porsi percakapan yang membicarakan tiap brand dari total percakapan semua brand yang dipantau.",
  brand_sentiment: "Perbandingan sentimen antar brand — Deriv vs kompetitor (Exness, IQ Option, OctaFX).",
  aspect_matrix: "Sentimen per aspek produk (withdrawal, platform, dsb.) antar brand — tempat Deriv unggul atau tertinggal.",
  switchers: "Postingan nyata dari user yang menyatakan pindah dari satu brand ke brand lain. Klik sumber untuk membaca postingan aslinya.",
  kol_score:
    "Skor pengaruh = total engagement × frekuensi posting × dampak negatif. Skor tinggi + banyak keluhan = risiko reputasi; skor tinggi + positif = kandidat advocate.",
  kol_profile: "Klik nama author untuk membuka profil/channel aslinya di tab baru (Reddit/YouTube).",
  kol_example: "Contoh postingan terbaru dari author ini — klik untuk membuka di tab baru.",
  version_rating: "Rata-rata bintang Google Play review yang menyebut versi aplikasi ini.",
  version_sentiment: "Sentimen AI dari teks review untuk versi ini — bisa beda dari rating bintang.",
  version_aspects: "Keluhan/puji utama yang muncul di versi ini; merah = keluhan, hijau = pujian.",
  correlation_r:
    "Koefisien Pearson r (-1..+1): seberapa kuat dua metrik bergerak bersamaan. Di atas 0.4 atau di bawah -0.4 = hubungan yang berarti (belum tentu sebab-akibat).",
  search_score: "Skor relevansi hasil pencarian (gabungan keyword match + kemiripan makna).",
  ask_tab: "Ajukan pertanyaan dalam bahasa bebas — AI menjawab berdasarkan data yang terkumpul, lengkap dengan agregasi yang dipakai.",
  draft_reply: "AI menyusun draf balasan (dalam bahasa postingan asli) yang bisa Anda copy ke platform sumbernya.",
  faq_generated: "Pertanyaan yang paling sering muncul dari data nyata, dijawab otomatis oleh AI dalam bahasa user.",
  tickets: "Draf balasan yang Anda tandai 'escalate' dari halaman Search masuk ke antrean di sini.",
  llm_costs: "Estimasi biaya pemakaian AI (LLM) per keperluan: enrichment sentimen, chat, copilot, dll.",
  bot_filter: "Postingan yang terdeteksi bot/spam otomatis dikeluarkan dari semua analitik.",
  enrichment: "Setiap postingan dianalisis AI: sentimen, emosi, aspek keluhan, topik, tahap journey, negara, dan bot detection.",
} as const;

export type HelpKey = keyof typeof HELP;

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: { section: string; entries: GlossaryEntry[] }[] = [
  {
    section: "Metrik utama",
    entries: [
      { term: "Mention", definition: "Satu unit data: postingan Reddit, komentar YouTube, review Google Play, atau artikel web yang menyebut brand yang dipantau." },
      { term: "Sentimen", definition: "Klasifikasi AI: positive / negative / neutral / mixed, dengan skor -1 sampai +1 dan tingkat confidence." },
      { term: "Weighted sentiment", definition: "Rata-rata sentimen yang dibobot engagement. Postingan populer (banyak view/like/komentar) diberi pengaruh lebih besar." },
      { term: "Engagement", definition: "Interaksi pada postingan asli: skor/upvote Reddit, views/likes YouTube, thumbs-up Google Play. Dipakai untuk membobot pengaruh." },
      { term: "Share of voice", definition: "Persentase percakapan yang membicarakan satu brand dibanding semua brand yang dipantau." },
    ],
  },
  {
    section: "AI enrichment",
    entries: [
      { term: "Aspect", definition: "Aspek spesifik yang dibahas, mis. 'withdrawal delay', 'kyc document', 'app crash' — disimpulkan AI dari teks." },
      { term: "Topic", definition: "Label topik yang lebih luas dari aspek, dipakai untuk pelacakan tren dan deteksi anomali per topik." },
      { term: "Journey stage", definition: "Tahap perjalanan user: signup, kyc, deposit, trading, withdrawal, support — menunjukkan di bagian mana user terkendala." },
      { term: "Lokasi (located)", definition: "Negara asal mention, diduga dari negara Google Play (confidence tinggi), bahasa, subreddit, atau domain. Tidak semua mention bisa dilokasi." },
      { term: "Local hour", definition: "Jam lokal di negara pengguna saat posting — dipakai untuk pola 'keluhan tengah malam'." },
      { term: "Bot detection", definition: "AI menandai postingan spam/bot; yang terdeteksi dikeluarkan dari semua angka analitik." },
    ],
  },
  {
    section: "Deteksi & peringatan",
    entries: [
      { term: "z-score", definition: "Seberapa jauh nilai sekarang menyimpang dari normal, dalam satuan simpangan baku. Di atas ~3 = anomali nyata." },
      { term: "Baseline", definition: "Nilai rata-rata normal yang dipakai pembanding deteksi anomali." },
      { term: "Severity", definition: "Tingkat keparahan alert: low, medium, high, critical — ditentukan dari z-score, confidence, dan dampak." },
    ],
  },
  {
    section: "Sumber data & pipeline",
    entries: [
      { term: "Reddit", definition: "Post dan komentar dari pencarian keyword (OAuth API). Tautan sumber menunjuk ke thread aslinya." },
      { term: "YouTube", definition: "Video (judul, deskripsi, statistik) + komentar teratas. Tautan komentar menunjuk langsung ke komentar tersebut." },
      { term: "Google Play", definition: "Review aplikasi per negara (termasuk rating bintang dan versi aplikasi). Tautan menunjuk ke review di Play Store." },
      { term: "Tavily (web/news)", definition: "Artikel berita dan web yang menyebut brand, dicari lewat Tavily API." },
      { term: "Grab / cron", definition: "Pengambilan data terjadwal otomatis: Reddit tiap 15 menit, YouTube & Google Play tiap jam, web tiap 6 jam. Bisa juga dipicu manual dari dashboard." },
      { term: "Enrichment queue", definition: "Setelah di-grab, tiap item masuk antrean analisis AI. Angka analitik bertambah bertahap sampai antrean selesai." },
    ],
  },
];
