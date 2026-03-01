use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::{BufWriter, Write},
    path::Path,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const SUBMODULE_DIR: &str = "warframe-packages-bin-data";
const PUBLIC_DIR: &str = "public";
const CHUNKS_DIR: &str = "public/chunks";
const SUBMODULE_URL: &str = "https://github.com/Sainan/warframe-packages-bin-data";

// ── Git helpers ───────────────────────────────────────────────────────────────

fn git_output(args: &[&str]) -> String {
    Command::new("git")
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default()
        .trim()
        .to_string()
}

// ── Directory walker ──────────────────────────────────────────────────────────

/// writers: root_dir_name → (BufWriter, paths_written_count)
type Writers = BTreeMap<String, (BufWriter<File>, u64)>;

/// Depth-first walk with sorted entries → output is globally sorted.
fn walk(dir: &Path, path_prefix: &str, writers: &mut Writers) {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };

    let mut entries: Vec<_> = read_dir.filter_map(|e| e.ok()).collect();
    // Sort by file name for deterministic, lexicographic output
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if name_str == ".git" {
            continue;
        }

        let Ok(ft) = entry.file_type() else {
            continue;
        };

        // Build the logical path: /RootDir/Sub/…
        let child_prefix = format!("{}/{}", path_prefix, name_str);

        if ft.is_dir() {
            walk(&entry.path(), &child_prefix, writers);
        } else if ft.is_file() && name_str.ends_with(".json") {
            // Strip the .json extension to get the logical package path
            let logical = &child_prefix[..child_prefix.len() - 5];

            // Root dir = second segment after leading '/'
            // child_prefix = "/Lotus/Weapons/…" → root = "Lotus"
            let root = logical
                .trim_start_matches('/')
                .split('/')
                .next()
                .unwrap_or("");

            if let Some((writer, count)) = writers.get_mut(root) {
                if *count > 0 {
                    writer.write_all(b"\n").unwrap();
                }
                writer.write_all(logical.as_bytes()).unwrap();
                *count += 1;
            }
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

fn main() {
    if !Path::new(SUBMODULE_DIR).exists() {
        eprintln!("[gen-trie] ERROR: submodule '{}' not found", SUBMODULE_DIR);
        std::process::exit(1);
    }

    let t0 = SystemTime::now();

    // ── Git metadata ──
    let commit = {
        let s = git_output(&["-C", SUBMODULE_DIR, "rev-parse", "HEAD"]);
        if s.is_empty() { "unknown".into() } else { s }
    };
    let commit_msg = {
        let s = git_output(&["-C", SUBMODULE_DIR, "log", "-1", "--format=%s"]);
        if s.is_empty() { "unknown".into() } else { s }
    };

    // ── Discover root directories ──
    let mut root_dirs: Vec<String> = fs::read_dir(SUBMODULE_DIR)
        .expect("Cannot read submodule dir")
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name() != ".git"
                && e.file_type().map(|t| t.is_dir()).unwrap_or(false)
        })
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    root_dirs.sort();

    // ── Create output dirs ──
    fs::create_dir_all(CHUNKS_DIR).expect("Cannot create chunks dir");

    // ── Open one writer per root dir ──
    let mut writers: Writers = BTreeMap::new();
    for root in &root_dirs {
        let path = format!("{}/{}.txt", CHUNKS_DIR, root);
        let file = File::create(&path)
            .unwrap_or_else(|e| panic!("Cannot create {}: {}", path, e));
        writers.insert(root.clone(), (BufWriter::new(file), 0));
    }

    println!("[gen-trie] Walking {} root dirs in {}...", root_dirs.len(), SUBMODULE_DIR);

    // ── Walk and write ──
    walk(Path::new(SUBMODULE_DIR), "", &mut writers);

    // ── Flush and collect stats ──
    let mut total_files: u64 = 0;
    for (root, (writer, count)) in &mut writers {
        writer.flush().unwrap();
        total_files += *count;
        eprintln!("[gen-trie]   chunks/{}.txt  ({} files)", root, count);
    }

    // ── Write tree-meta.json ──
    let generated_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let meta = serde_json::json!({
        "submodule_url":             SUBMODULE_URL,
        "submodule_commit":          commit,
        "submodule_commit_message":  commit_msg,
        "total_files":               total_files,
        "root_dirs":                 root_dirs,
        "generated_at":              generated_at_ms,
    });

    fs::write(
        format!("{}/tree-meta.json", PUBLIC_DIR),
        serde_json::to_string(&meta).unwrap(),
    )
    .expect("Cannot write tree-meta.json");

    let elapsed = t0.elapsed().unwrap_or_default().as_secs_f32();
    println!(
        "[gen-trie] Done in {:.2}s — {} files across {} root dirs",
        elapsed,
        total_files,
        root_dirs.len()
    );
}
