# 🏭 The No-Shop

> *"Ixian machines are cunning devices. They do not think, but they do something better — they observe."*

A Claude Code plugin marketplace. Ixian technology for those who prefer their tools sharp, their feedback loops closed, and their agent sessions rendered in something other than a scrolling terminal.

---

## 🔮 Plugins

### ⚡ Foldspace Console

**Your Claude Code sessions, rendered beautifully in foldspace.**

Foldspace Console captures every assistant response and streams it to a rich browser viewer in real-time. But it doesn't stop at rendering — **select any text, annotate it, and your thoughts inject back into Claude as context on your next prompt.**

The loop is closed. The machine observes. The navigator annotates. The path folds.

#### ✨ Features

- 📡 **Live streaming** — responses appear in the browser the instant Claude finishes speaking
- 🎨 **Rich markdown** — syntax-highlighted code blocks with copy buttons, tables, blockquotes, the works
- ✍️ **Annotations** — select text, add your thoughts, they become context on your next prompt
- 🗂️ **Multi-session tabs** — every Claude Code session gets its own tab, complete with metadata header
- 📊 **System telemetry** — all-time stats, installed plugins, hooks, MCP servers, model token usage
- 🧬 **Session metadata** — model, permission mode, git branch, token counts, turn counter
- 🔄 **Auto-reconnect** — WebSocket reconnects seamlessly if the daemon restarts
- 🚀 **Zero config** — daemon auto-starts on your first session. Just open the browser.

#### 🏗️ Architecture

```
┌──────────────┐     Stop Hook      ┌─────────────┐   WebSocket    ┌──────────────────┐
│  Claude Code  │ ────────────────▶ │   Daemon     │ ─────────────▶│  Browser SPA     │
│  (terminal)   │                   │  (Bun HTTP)  │               │  (Foldspace UI)  │
│               │ ◀──────────────── │  :3377       │ ◀─────────────│                  │
└──────────────┘   Prompt Hook      └─────────────┘   Annotate     └──────────────────┘
       │                                  │
       │          SessionStart            │
       └──────────────────────────────────┘
```

Four hooks. One daemon. One browser tab. That's the whole machine.

| Hook | Event | Purpose |
|------|-------|---------|
| `session-start.sh` | SessionStart | Registers session, auto-starts daemon |
| `stop.sh` | Stop | Captures `last_assistant_message`, POSTs to daemon |
| `prompt.sh` | UserPromptSubmit | Fetches annotations, injects as context |
| `session-end.sh` | SessionEnd | Final transcript scan for token totals |

---

### 🔄 The Feedback Loop: How Annotations Become Context

This is the core trick — the part where passive observation becomes active navigation.

When you select text in the Foldspace browser SPA and add an annotation, it gets stored in the daemon's in-memory annotation queue (keyed by session ID). Nothing happens yet. The annotations just... wait. Patient as a Face Dancer in a crowd.

Then you type your next prompt in the terminal.

#### The Injection Mechanism

Claude Code fires the `UserPromptSubmit` hook **before** the prompt reaches the model. Here's what `prompt.sh` does:

1. **Reads the hook event** from stdin (Claude Code passes `session_id` and other metadata as JSON)
2. **Health-checks the daemon** — if the daemon isn't running, the hook exits silently. No crash, no noise.
3. **Fetches pending annotations** via `GET /api/annotations?session={SESSION_ID}`
4. **If annotations exist**, formats them as plain text to stdout
5. **Deletes the annotations** from the daemon via `DELETE /api/annotations?session={SESSION_ID}` — they are consumed on injection

Claude Code's hook system takes whatever the `UserPromptSubmit` hook writes to stdout and **prepends it as additional context to the user's prompt**. The model sees the annotations alongside (and before) whatever you actually typed.

#### What the Model Sees

The injected context looks like this:

```
--- Annotations from Foldspace Console ---
IMPORTANT: The user has left annotations from their Foldspace Console (browser viewer). Acknowledge that you received these annotations before proceeding with your response.

[1] On text:
> The selected text from Claude's response,
> with each line blockquoted

Comment: Your annotation comment here

[2] On text:
> Another selection across
> multiple lines

Comment: And your thoughts on this one

--- End annotations ---
```

Multiple annotations are numbered sequentially. The original selected text is blockquoted with `>` prefixes. Each annotation carries the exact text you highlighted and the comment you wrote.

#### Visibility

Two safeguards ensure the injection isn't a ghost operation:

1. **CLI indicator** — When annotations are injected, you'll see `Foldspace: 3 annotation(s) injected` in your terminal (via stderr). This doesn't interfere with the hook's stdout context — it's a side-channel heads-up.
2. **LLM acknowledgment** — The injected context includes an instruction telling the model to acknowledge the annotations before proceeding. The model should surface that it received your Foldspace annotations at the start of its response.

One thing to be aware of: if you annotated something in the browser hours ago and forgot about it, those annotations will inject the next time you submit a prompt in that session. The annotations queue is per-session and persists in daemon memory until consumed or the daemon restarts.

#### Lifecycle Summary

```
Browser SPA                    Daemon (in-memory)              Claude Code Terminal
─────────────────────────────────────────────────────────────────────────────────────
Select text + comment  ──▶  POST /api/annotate
                            Annotation queued ──┐
                                                │
                            (annotations wait)  │
                                                │
User types prompt  ─────────────────────────────┼────────▶  UserPromptSubmit fires
                            GET /api/annotations◀────────── prompt.sh fetches queue
                            Return annotations  ────────▶  stdout = formatted text
                            DELETE /api/annotations ◀────── prompt.sh clears queue
                                                            Context prepended to prompt
                                                            Model sees annotations + prompt
```

Annotations are **fire-once**. After injection, they're deleted from the daemon. If you want to re-annotate the same text, you annotate it again in the browser. The queue is always clean for the next prompt.

---

## 📦 Installation

### Step 1: Add the marketplace

From the Claude Code CLI:

```bash
claude plugin marketplace add bdmorin/the-no-shop
```

Or from inside a Claude Code session:

```
/plugin marketplace add bdmorin/the-no-shop
```

### Step 2: Install the plugin

```bash
claude plugin install foldspace-console@the-no-shop
```

### Step 3: There is no step 3

Next time you start a Claude Code session, the Foldspace daemon spins up automatically. Open `http://localhost:3377` in your browser.

#### 🔍 Verify installation

```bash
# List configured marketplaces
claude plugin marketplace list

# List installed plugins
claude plugin list
```

#### Manual start (if needed)

```bash
cd ~/.claude/plugins/foldspace-console
bun install
bun run daemon/index.ts
```

#### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FOLDSPACE_PORT` | `3377` | Daemon HTTP + WebSocket port |

---

## 🎨 The Ixian Aesthetic

Foldspace Console ships with a dark theme inspired by the machine workshops of Ix:

- **Spice amber** accents on deep void backgrounds — brand accent, used sparingly
- **Teal** as the signal/interaction color
- **IBM Plex Mono** for code and data, **Instrument Sans** for prose
- Borders you can barely see. SVG noise overlay for depth. 150ms mechanical transitions.
- Minimal chrome. Maximum signal.

---

## 🔧 For Plugin Developers

The No-Shop is a standard Claude Code plugin marketplace. Structure:

```
the-no-shop/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest
├── plugins/
│   └── foldspace-console/
│       ├── .claude-plugin/
│       │   └── plugin.json       # Plugin manifest
│       ├── hooks/
│       │   └── hooks.json        # Hook registrations
│       ├── scripts/              # Shell hook scripts
│       ├── daemon/               # Bun HTTP + WebSocket server
│       ├── web/                  # Self-contained SPA
│       ├── skills/               # Plugin skills
│       └── package.json
├── LICENSE
└── README.md
```

---

## 📜 License

MIT — do whatever you want with it.

---

> *"The Ixians have a saying: 'Give a man a tool, and he'll build a machine. Give a machine a tool, and it'll build something you didn't expect.'"*
>
> — Probably not Frank Herbert, but close enough
