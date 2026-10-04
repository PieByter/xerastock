#!/usr/bin/env node
/**
 * Generator commit otomatis (Conventional Commits) untuk monorepo ini.
 *
 * Membaca perubahan di working tree, mengelompokkannya per tipe + scope
 * (`feat(web)`, `refactor(engine)`, …), lalu menyusun pesan commit. Secara
 * default hanya menampilkan rencana — pakai `--apply` untuk benar-benar commit.
 *
 * Contoh:
 *   npm run commit:auto                 # lihat rencana (dry-run)
 *   npm run commit:auto -- --apply      # buat commit-nya
 *   npm run commit:auto -- --staged     # hanya yang sudah di-stage
 *   npm run commit:auto -- --json       # keluaran JSON (untuk tooling lain)
 *
 * Scope diturunkan otomatis dari daftar `workspaces` di package.json root,
 * tipe ditentukan dari status berkas + isi diff. Override opsional lewat
 * `.commitrc.json` (lihat README).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const getOption = (name) => {
    const hit = args.find((arg) => arg.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
};

const apply = hasFlag("apply");
const stagedOnly = hasFlag("staged");
const asJson = hasFlag("json");
const coAuthor = getOption("co-author") ?? null;

const git = (gitArgs, options = {}) =>
    execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });

const root = git(["rev-parse", "--show-toplevel"]).trim();
process.chdir(root);

// ---------- Konfigurasi ----------

const rc = existsSync(".commitrc.json") ? JSON.parse(readFileSync(".commitrc.json", "utf8")) : {};
const rules = rc.rules ?? [];
const overrides = rc.overrides ?? {};

/** Urutan tipe di riwayat commit (fitur dulu, housekeeping belakangan). */
const TYPE_ORDER = ["feat", "fix", "perf", "refactor", "test", "style", "docs", "build", "ci", "chore"];

const TYPE_VERB = {
    feat: "tambah",
    fix: "perbaiki",
    perf: "optimalkan",
    refactor: "rapikan",
    test: "tambah tes untuk",
    style: "rapikan tampilan",
    docs: "perbarui dokumentasi",
    build: "perbarui konfigurasi",
    ci: "perbarui pipeline CI",
    chore: "perbarui",
};

/** Berkas yang tidak boleh ikut ter-commit (kredensial). */
const SECRET_PATTERNS = [
    /(^|\/)\.env(\.(?!example)[^/]*)?$/i,
    /\.(pem|key|p12|pfx|jks|keystore)$/i,
    /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.|$)/i,
    /(^|\/)credentials(\.|$)/i,
];

// ---------- Aturan tipe per berkas ----------

const DEFAULT_RULES = [
    { match: /(^|\/)(test|tests|__tests__)\//, type: "test" },
    { match: /\.(test|spec)\.[cm]?[jt]sx?$/, type: "test" },
    { match: /\.md$/, type: "docs" },
    { match: /(^|\/)(README|CHANGELOG|CONTRIBUTING|LICENSE)/i, type: "docs" },
    { match: /(^|\/)\.env\.example$/, type: "chore" },
    { match: /(^|\/)(\.gitignore|\.gitattributes|\.editorconfig|\.npmrc)$/, type: "chore" },
    { match: /(^|\/)\.vscode\//, type: "chore" },
    { match: /(^|\/)\.github\/|(^|\/)\.gitlab-ci|(^|\/)Jenkinsfile/, type: "ci" },
    { match: /(^|\/)package-lock\.json$/, type: "build" },
    { match: /(^|\/)tsconfig[^/]*\.json$|(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml)$/, type: "build" },
    { match: /\.(prisma|sql)$/, type: "feat" },
    { match: /\.(css|scss)$/, type: "style" },
];

const COMPILED_RULES = [
    ...DEFAULT_RULES,
    ...rules.map((rule) => ({ match: new RegExp(rule.match), type: rule.type, scope: rule.scope })),
];

const matchRule = (path) => COMPILED_RULES.find((rule) => rule.match.test(path));

/** Scope otomatis dari workspace npm (@stock-analyst/web → apps/web/** → "web"). */
function buildScopes() {
    const dirs = new Set();

    try {
        const pkg = JSON.parse(readFileSync("package.json", "utf8"));
        for (const pattern of pkg.workspaces ?? []) {
            const wildcard = pattern.indexOf("*");
            if (wildcard === -1) {
                if (existsSync(pattern)) dirs.add(pattern);
                continue;
            }
            // "apps/*" → semua subdirektori apps/ (git memakai pemisah "/").
            const base = pattern.slice(0, wildcard).replace(/\/+$/, "") || ".";
            if (!existsSync(base)) continue;
            for (const entry of readdirSync(base, { withFileTypes: true })) {
                if (entry.isDirectory()) dirs.add(`${base}/${entry.name}`);
            }
        }
    } catch {
        // tanpa workspaces → semua berkas tanpa scope
    }

    const scopes = [];
    for (const dir of dirs) {
        const manifestPath = join(dir.split("/").join(sep), "package.json");
        if (!existsSync(manifestPath)) continue;
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        scopes.push({ prefix: `${dir}/`, scope: String(manifest.name ?? dir).split("/").pop() });
    }
    return scopes;
}

const SCOPES = buildScopes();

function scopeFor(path) {
    return matchRule(path)?.scope ?? SCOPES.find((entry) => path.startsWith(entry.prefix))?.scope ?? null;
}

// ---------- Baca status & diff ----------

/** Daftar berkas yang berubah, lengkap dengan statusnya. */
function readChanges() {
    const changes = [];

    if (stagedOnly) {
        const parts = git(["diff", "--cached", "--name-status", "-z"]).split("\0");
        for (let i = 0; i < parts.length; i++) {
            const code = parts[i];
            const path = parts[i + 1];
            if (!code || !path) continue;
            i++;
            changes.push({ status: code.trim()[0] ?? "M", path });
        }
        return changes;
    }

    const parts = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]).split("\0");
    for (const entry of parts) {
        if (entry.length < 4) continue;
        const statusCode = entry.slice(0, 2);
        changes.push({ status: statusCode.trim() === "??" ? "A" : (statusCode.trim()[0] ?? "M"), path: entry.slice(3) });
    }

    // Urutkan per path supaya urutan grup & penggabungan tes deterministik.
    return changes.sort((a, b) => a.path.localeCompare(b.path));
}

/** Baris yang ditambahkan/dihapus untuk satu berkas (tanpa baris konteks). */
function readDiff(path, status) {
    if (status === "A") {
        const content = existsSync(path) ? readFileSync(path, "utf8") : "";
        return { added: content.split("\n"), removed: [] };
    }

    const diffArgs = stagedOnly ? ["diff", "--cached"] : ["diff"];
    const raw = git([...diffArgs, "--unified=0", "--no-color", "--", path]);
    const added = [];
    const removed = [];
    for (const line of raw.split("\n")) {
        if (line.startsWith("+++") || line.startsWith("---")) continue;
        if (line.startsWith("+")) added.push(line.slice(1));
        else if (line.startsWith("-")) removed.push(line.slice(1));
    }
    return { added, removed };
}

// ---------- Klasifikasi ----------

const DECLARATION_PATTERNS = [
    /^\s*export\s+(default\s+)?(async\s+)?(function|const|let|class|interface|type|enum)\b/,
    /^\s*(async\s+)?function\s+\w+/,
    /^\s*(interface|type|enum|class)\s+\w+/,
    /^\s*model\s+\w+/,
    /^\s*(CREATE|ALTER)\s+(TABLE|INDEX)/i,
    /^\s*"[\w.@/-]+"\s*:/,
];

const isDeclaration = (line) => DECLARATION_PATTERNS.some((pattern) => pattern.test(line));

function classify(change, diff) {
    if (/package\.json$/.test(change.path)) {
        return diff.added.some((line) => /"(dependencies|devDependencies|peerDependencies)"/.test(line)) ? "build" : "chore";
    }
    if (change.status === "A") return "feat";
    if (change.status === "D") return "refactor";
    if (diff.added.some(isDeclaration)) return "feat";
    return "refactor";
}

// ---------- Penamaan manusiawi untuk subjek ----------

const GENERIC_NAMES = new Set([
    "index",
    "page",
    "layout",
    "route",
    "main",
    "utils",
    "types",
    "app",
    "client",
    "server",
    "config",
    "src",
    "lib",
    "test",
    "tests",
    "e2e",
    "styles",
    "hooks",
    "public",
]);

/** Nama berkas yang benar-benar tidak menjelaskan apa pun. */
const VAGUE_FILES = new Set(["index", "page", "layout", "route", "main"]);

const humanize = (name) =>
    name
        .replace(/[-_.]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

function highlightsFor(group) {
    const added = [];
    const exports = [];
    const modified = [];
    const dirs = [];

    // Konfigurasi, dokumentasi & refactor lebih jelas disebut dengan nama berkasnya;
    // fitur lebih enak dibaca sebagai nama fitur hasil humanize.
    const byName = ["docs", "build", "chore", "ci", "refactor"].includes(group.type);
    // Nama berkas seperti index.ts/page.tsx tidak menjelaskan apa pun, sedangkan
    // config.ts/types.ts justru informatif.
    const vague = byName ? VAGUE_FILES : GENERIC_NAMES;

    // Berkas page/layout biasanya tipis; turunkan prioritasnya di subjek.
    const rank = (path) => (/\/(app|pages)\//.test(path) ? 1 : 0);

    for (const change of [...group.changes].sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path))) {
        const base = change.path.split("/").pop() ?? "";
        const bare = base.replace(/\.[^.]+$/, "");

        if (!vague.has(bare.toLowerCase())) {
            const label = byName || /\.(prisma|sql|json|ya?ml|toml)$/i.test(base) ? base : humanize(bare);
            (change.status === "A" ? added : modified).push(label);
        }

        if (byName) continue;
        for (const line of change.diff.added) {
            const exported = line.match(/^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/)?.[1];
            if (exported && !GENERIC_NAMES.has(exported.toLowerCase())) exports.push(humanize(exported));
        }
    }

    for (const change of group.changes) {
        const dir = change.path.split("/").slice(0, -1).pop() ?? "";
        // Lewati nama folder yang sama dengan scope (sudah tampil di header).
        if (dir && dir !== group.scope && !GENERIC_NAMES.has(dir)) dirs.push(dir);
    }

    // Buang kandidat yang berbagi kata kunci sama ("broker summary panel" vs "broker analysis").
    const dedupe = (items) => {
        const seen = new Set();
        return items.filter((item) => {
            const keyword = item.split(" ")[0] ?? item;
            if (seen.has(keyword)) return false;
            seen.add(keyword);
            return true;
        });
    };

    // Nama berkas selalu lebih spesifik daripada nama folder, jadi folder hanya
    // dipakai kalau tidak ada nama berkas yang bisa disebut.
    const primary = dedupe([...added, ...exports, ...modified]);
    if (primary.length > 0) return primary;
    if (dirs.length > 0) return dedupe(dirs);
    return group.changes.map((change) => change.path.split("/").pop());
}

const joinList = (items) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} dan ${items[items.length - 1]}`);

function subjectFor(group) {
    const header = `${group.type}${group.scope ? `(${group.scope})` : ""}: ${TYPE_VERB[group.type] ?? "perbarui"}`;
    const highlights = highlightsFor(group);

    for (let count = Math.min(highlights.length, 3); count >= 1; count--) {
        const candidate = `${header} ${joinList(highlights.slice(0, count))}`;
        if (candidate.length <= 72) return candidate;
    }
    return `${header} ${group.changes.length} berkas`.slice(0, 72);
}

const STATUS_LABEL = { A: "baru", M: "ubah", D: "hapus", R: "ganti nama" };

function bodyFor(group) {
    const lines = ["Berkas:"];
    for (const change of [...group.changes].sort((a, b) => a.path.localeCompare(b.path))) {
        lines.push(`- [${STATUS_LABEL[change.status] ?? "ubah"}] ${change.path}`);
    }
    if (coAuthor === "copilot") {
        lines.push("", "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>");
    }
    return lines.join("\n");
}

// ---------- Susun grup commit ----------

const skipped = [];
const groups = new Map();

for (const change of readChanges()) {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(change.path))) {
        skipped.push(change.path);
        continue;
    }

    const diff = readDiff(change.path, change.status);
    const overrideMatch = overrides[change.path]?.match(/^(\w+)(?:\(([^)]+)\))?$/);
    const type = overrideMatch?.[1] ?? matchRule(change.path)?.type ?? classify(change, diff);
    const scope = overrideMatch?.[2] ?? scopeFor(change.path);

    const key = `${type}|${scope ?? ""}`;
    if (!groups.has(key)) groups.set(key, { type, scope, changes: [] });
    groups.get(key).changes.push({ ...change, diff });
}

// Tes yang se-scope digabung ke commit fitur/refactor-nya supaya riwayat lebih rapi.
if (rc.mergeTestsIntoFeature !== false) {
    for (const [key, group] of [...groups]) {
        if (group.type !== "test") continue;

        const hosts = [...groups]
            .filter(([otherKey, other]) => otherKey !== key && other.scope === group.scope && (other.type === "feat" || other.type === "refactor"))
            .sort((a, b) => TYPE_ORDER.indexOf(a[1].type) - TYPE_ORDER.indexOf(b[1].type));

        const host = hosts[0];
        if (!host) continue;
        host[1].changes.push(...group.changes);
        groups.delete(key);
    }
}

const ordered = [...groups.values()].sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || String(a.scope).localeCompare(String(b.scope)),
);

for (const group of ordered) {
    group.subject = subjectFor(group);
    group.body = bodyFor(group);
    group.message = `${group.subject}\n\n${group.body}\n`;
}

// ---------- Keluaran ----------

if (asJson) {
    console.log(
        JSON.stringify(
            {
                commits: ordered.map((group) => ({
                    type: group.type,
                    scope: group.scope,
                    subject: group.subject,
                    message: group.message,
                    files: group.changes.map((change) => change.path),
                })),
                skipped,
            },
            null,
            2,
        ),
    );
    process.exit(0);
}

if (ordered.length === 0) {
    console.log("Tidak ada perubahan untuk di-commit.");
    process.exit(0);
}

const total = ordered.reduce((sum, group) => sum + group.changes.length, 0);
console.log(`${apply ? "MEMBUAT" : "RENCANA"} ${ordered.length} COMMIT (${total} berkas)\n`);

for (const [index, group] of ordered.entries()) {
    console.log(`${index + 1}) ${group.subject}`);
    for (const change of group.changes) {
        console.log(`   ${change.status === "A" ? "+" : change.status === "D" ? "-" : "~"} ${change.path}`);
    }
    console.log("");
}

if (skipped.length > 0) console.log(`⚠️  Dilewati (terdeteksi berkas rahasia): ${skipped.join(", ")}\n`);

if (!apply) {
    console.log("Dry-run — jalankan ulang dengan --apply untuk membuat commit-nya.");
    process.exit(0);
}

if (!git(["config", "user.name"]).trim()) {
    console.error("❌ git user.name belum diatur — commit tidak bisa dibuat.");
    process.exit(1);
}

for (const group of ordered) {
    git(["add", "-A", "--", ...group.changes.map((change) => change.path)]);
    git(["commit", "-F", "-"], { input: group.message });
    console.log(`✓ ${group.subject}`);
}

console.log(`\nSelesai — ${ordered.length} commit dibuat.`);
