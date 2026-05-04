#!/usr/bin/env python3
"""Launch the OpenCode metadata manager (TUI or CLI).

This wrapper keeps the previous entry point name but shells out to the
Bun-powered entrypoint at ``src/bin/opencode-manager.ts``. The routing logic
detects CLI subcommands (projects, sessions, chat, tokens) and passes them
directly, otherwise defaults to the TUI.

Usage:
  manage_opencode_projects.py                    # Launch TUI (default)
  manage_opencode_projects.py projects list      # CLI: list projects
  manage_opencode_projects.py sessions list      # CLI: list sessions
  manage_opencode_projects.py -- --help          # Show TUI help
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence

# CLI subcommands that route to the CLI module instead of TUI
CLI_SUBCOMMANDS = frozenset({"projects", "sessions", "chat", "tokens"})

PROJECT_DIR = Path(__file__).resolve().parent


def find_bun(explicit_path: str | None = None) -> str:
    """Locate bun executable, preferring explicit path if provided."""
    if explicit_path:
        return explicit_path
    bun_path = shutil.which("bun")
    if bun_path:
        return bun_path
    raise SystemExit("bun executable not found. Please install Bun.")


def is_cli_subcommand(args: Sequence[str]) -> bool:
    """Check if the first non-flag argument is a CLI subcommand."""
    for arg in args:
        if arg.startswith("-"):
            # Skip flags like --bun, --root, etc.
            continue
        # First positional argument determines routing
        return arg in CLI_SUBCOMMANDS
    return False


def run_entrypoint(bun_exe: str, args: Sequence[str]) -> int:
    """Run the main entrypoint with given arguments.
    
    The TypeScript entrypoint handles all routing internally:
    - CLI subcommands (projects, sessions, chat, tokens) → CLI module
    - Everything else → TUI
    """
    # Normalize: drop leading "--" if present (legacy passthrough syntax)
    args_list = list(args)
    if args_list and args_list[0] == "--":
        args_list = args_list[1:]
    
    cmd = [bun_exe, "src/bin/opencode-manager.ts"] + args_list
    process = subprocess.run(cmd, cwd=PROJECT_DIR)
    return process.returncode


def main(argv: Sequence[str] | None = None) -> int:
    """Main entry point.
    
    Parses minimal wrapper-level options (--bun) and forwards everything
    else to the TypeScript entrypoint which handles TUI/CLI routing.
    """
    if argv is None:
        argv = sys.argv[1:]
    
    args = list(argv)
    bun_exe_path: str | None = None
    
    # Extract --bun option if present (wrapper-level option only)
    filtered_args: list[str] = []
    i = 0
    while i < len(args):
        if args[i] == "--bun" and i + 1 < len(args):
            bun_exe_path = args[i + 1]
            i += 2
        elif args[i].startswith("--bun="):
            bun_exe_path = args[i].split("=", 1)[1]
            i += 1
        else:
            filtered_args.append(args[i])
            i += 1
    
    bun_exe = find_bun(bun_exe_path)
    return run_entrypoint(bun_exe, filtered_args)


if __name__ == "__main__":
    sys.exit(main())
