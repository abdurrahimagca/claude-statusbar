# statusbar

A Claude Code mod that turns the hint line under the prompt into a compact status row:

```
⏵⏵ auto mode on · IN ctx 16% | rlh 42%, 1h20m | ⏳58m | al**@ex** | my-repo | fix/otp #1389
```

| Part | Meaning |
| --- | --- |
| `IN` | Vim mode (`-- INSERT --` shortened); "shift+tab to cycle" is dropped |
| `ctx 16%` | Context window used |
| `rlh 42%, 1h20m` | 5-hour rate limit used, and time until it resets |
| `⏳58m` | Estimated prompt-cache time left (`⏳cold` once expired) |
| `al**@ex**` | Account this session is logged in with (from `claude auth status`), masked; `api key` for API-key logins |
| `my-repo \| fix/otp` | Git repo and branch |
| `#1389` | The branch's PR, colored by CI: green pass, yellow running, red failed, purple merged |

The row wraps at the `|` separators on narrow terminals.

## Install

```
/plugin install statusbar --marketplace abdurrahimagca/claude-statusbar
```

Answer `y` to add the marketplace, then pick a scope. If you use a `statusLine` command in your settings, remove it to avoid two status lines.

Requirements: `git` and an authenticated `gh` CLI (PR and CI).

## Limits

- The cache countdown is an estimate. Claude Code only exposes the cache TTL to model-switch hooks, so it assumes 1h (subscription default) until a model switch reports the real TTL, and it starts at the last main-loop reply that read or wrote the cache.
- The `⏵⏵ auto mode on` label is drawn by Claude Code itself; a mod cannot hide or move it.

## Develop

```
claude plugin validate .
claude plugin test .
```

Or load a working copy in every session by adding its path to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`.
