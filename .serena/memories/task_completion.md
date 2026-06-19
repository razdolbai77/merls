- A coding task is not done until relevant tests/fixtures added first by TDD are passing under the repo's actual toolchain.
- The project has a runnable build/test command (\
pm run build\, \
pm test\); use them.
- Always review whether the task changed project behavior, structure, workflow, or contributor expectations.
- If yes, update both \README.md\ and \AGENTS.md\ in the same task.
- Preserve scope invariants: 6502 support only, 65816 rejection explicit, coc.nvim/stdio integration target unchanged unless the docs and plan are updated together.