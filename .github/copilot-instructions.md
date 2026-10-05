# Panduan untuk AI di repo ini

Dokumen ini dibaca otomatis oleh asisten AI (Copilot Chat / agent) di workspace ini.
Isinya konvensi yang dipakai repo — terutama untuk **generate pesan commit**.

## Konvensi pesan commit

Repo ini memakai **Conventional Commits** dengan ringkasan **Bahasa Indonesia**.

```
<tipe>(<scope>): <ringkasan imperatif>
```

- **Tipe**: `feat`, `fix`, `perf`, `refactor`, `test`, `style`, `docs`, `build`, `ci`, `chore`.
- **Scope** mengikuti nama workspace npm: `web` (apps/web), `worker` (apps/worker),
  `engine` (packages/engine), `db` (packages/db), `shared` (packages/shared).
  Berkas root/dokumentasi boleh tanpa scope atau memakai `docs`.
- **Ringkasan**: kata kerja imperatif Bahasa Indonesia (`tambah`, `perbaiki`, `rapikan`,
  `perbarui`, `optimalkan`), maksimal **72 karakter total**, tanpa titik di akhir.
- **Body** (opsional): daftar berkas dalam bentuk `- [baru|ubah|hapus] <path>`.

Contoh subjek yang benar:

```
feat(web): tambah halaman portfolio dan broker flow
fix(worker): perbaiki bar basi pada evaluasi sinyal
docs: perbarui panduan setup database
refactor(engine): rapikan perhitungan indikator
```

Contoh yang **salah**: `update files`, `fix bug`, `Perbaikan.`, `WIP`.

## Aturan tambahan

- Jangan pernah menyertakan berkas rahasia (`.env` asli, `*.pem`, `*.key`, kredensial)
  dalam saran commit.
- Tambahkan trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
  hanya jika diminta.
- Pengelompokan berkas per tipe + scope ditentukan oleh `scripts/auto-commit.mjs`
  (deterministik). AI hanya menulis teks subjeknya — jangan mengubah pengelompokan.

## Sumber kebenaran

`scripts/auto-commit.mjs` adalah sumber kebenaran untuk aturan tipe, scope, dan format
pesan. Kalau dokumen ini berbeda dengan script tersebut, ikuti script-nya.

```bash
npm run commit:auto            # rencana commit (dry-run)
npm run commit:auto -- --apply # buat commit-nya
npm run commit:auto -- --ai    # subjek ditulis AI (butuh ANTHROPIC_API_KEY)
```
