# Agents

- `useEffect` is banned (ast-grep rule `no-use-effect-*`). Stores load their data in
  their constructor; DOM listeners go in ref callbacks that return their cleanup.
- READMEs say what a folder is for and its boundaries. Do not list files, functions,
  props or changes in them.
