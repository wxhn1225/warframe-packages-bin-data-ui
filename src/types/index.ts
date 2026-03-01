export type TreeMeta = {
  submodule_url: string
  submodule_commit: string
  submodule_commit_message: string
  total_files: number
  /** Unix milliseconds — output by the Rust gen-trie tool */
  generated_at: number
  /** Root-level directory names, e.g. ["Configs","DS","EE","Engine","Lotus","Tests"] */
  root_dirs: string[]
}

export type ChildEntry = {
  name: string
  isDir: boolean
  path: string
}
