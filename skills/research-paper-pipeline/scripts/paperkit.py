#!/usr/bin/env python3
"""paperkit.py - shared helpers for the research-paper-pipeline.

The whole point of this module is portability. The original CMR scripts pinned an
absolute /sessions/.../outputs path from the session they were built in, so nothing
ran on reuse. Here, every path resolves at runtime:

  WORKDIR  - where a given paper's content/config/build live.
             From $PAPER_DIR if set, else the current working directory.
  SKILL_ROOT - the skill install dir (parent of scripts/), where profiles/ live.

Config lives in two files, so the engine stays generic:
  <WORKDIR>/paper.config.json  - THIS paper (title, authors, abstract, sections...)
  <SKILL_ROOT>/profiles/<id>.json (or <WORKDIR>/<id>.json) - THIS venue's format rules
"""
import os, json, re
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent

def workdir() -> Path:
    return Path(os.environ.get("PAPER_DIR", os.getcwd())).resolve()

def build_dir() -> Path:
    d = workdir() / "build"
    d.mkdir(parents=True, exist_ok=True)
    return d

def build_dir_for(wd) -> Path:
    d = Path(wd) / "build"
    d.mkdir(parents=True, exist_ok=True)
    return d

def load_json(path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def load_paper_config(wd: Path = None) -> dict:
    wd = wd or workdir()
    p = wd / "paper.config.json"
    if not p.exists():
        return {}
    return load_json(p)

def resolve_profile(profile_ref: str, wd: Path = None) -> dict:
    """profile_ref may be an id ('cmr'), a bare filename, or a full path.
    Search order: explicit path -> WORKDIR/<ref>.json -> SKILL_ROOT/profiles/<ref>.json."""
    wd = wd or workdir()
    candidates = []
    p = Path(profile_ref)
    if p.suffix == ".json":
        candidates += [p, wd / p.name]
    stem = p.stem
    candidates += [wd / f"{stem}.json", SKILL_ROOT / "profiles" / f"{stem}.json"]
    for c in candidates:
        if Path(c).exists():
            return load_json(c)
    raise FileNotFoundError(
        f"Profile '{profile_ref}' not found. Looked in: "
        + ", ".join(str(c) for c in candidates))

def get_profile(cli_profile: str = None, wd: Path = None) -> dict:
    """Profile precedence: --profile CLI arg > paper.config.json 'profile' > 'generic'."""
    wd = wd or workdir()
    cfg = load_paper_config(wd)
    ref = cli_profile or cfg.get("profile") or "generic"
    return resolve_profile(ref, wd)

def name_tokens(cfg: dict) -> list:
    """Lowercase identifying tokens for the blind-anonymity check: every author name
    part, plus any blind_extra_tokens (affiliations, 'about the authors', etc.)."""
    toks = set()
    for a in cfg.get("authors", []):
        name = a.get("name", "")
        for part in re.split(r"\s+", name.strip()):
            part = part.strip(".,").lower()
            if len(part) >= 3:
                toks.add(part)
        for key in ("affiliation", "email"):
            v = a.get(key, "")
            for part in re.split(r"[\s@.,;()]+", v.lower()):
                if len(part) >= 4 and not part.isdigit():
                    toks.add(part)
    for t in cfg.get("blind_extra_tokens", []):
        toks.add(t.lower())
    # common give-aways worth flagging regardless
    for t in ("about the authors",):
        toks.add(t)
    return sorted(toks)

if __name__ == "__main__":
    wd = workdir()
    cfg = load_paper_config(wd)
    print("SKILL_ROOT:", SKILL_ROOT)
    print("WORKDIR   :", wd)
    print("paper.config.json:", "found" if cfg else "MISSING")
    if cfg:
        prof = get_profile(wd=wd)
        print("profile   :", prof.get("id"), "-", prof.get("name"))
        print("blind tokens:", name_tokens(cfg))
