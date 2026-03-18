---
name: linq
description: Send messages to your human operator's phone via Linq (iMessage, RCS, SMS). Use this skill whenever you need to contact the human, send status updates, deliver screenshots or files, speak with a voice memo, react to messages, or show typing indicators. Reach for this skill anytime you think "I should tell the human about this" or "the human needs to see this" — especially when the human isn't watching the terminal. Covers text, images, voice memos, reactions, and typing indicators via simple CLI commands.
---

# Linq Messaging for Agents

Send messages to your human operator's phone. Text, images, voice memos, reactions, typing indicators — all via iMessage, RCS, or SMS through the Linq platform.

This is an anti-MCP tool: no server, no protocol negotiation. Just CLI commands with environment variables and exit codes.

## Prerequisites

These environment variables must be set before any command will work:

| Variable | Required | Purpose |
|----------|----------|---------|
| `LINQ_API_TOKEN` | Always | Linq Partner API bearer token |
| `LINQ_FROM_NUMBER` | Always | Your Linq phone number (E.164: `+15551234567`) |
| `LINQ_CHAT_ID` | For existing chats | Chat UUID for an established conversation |
| `LINQ_RECIPIENT_NUMBER` | For new chats | Recipient phone number (E.164) |
| `ELEVENLABS_API_KEY` | Voice memos only | ElevenLabs TTS API key |

If you don't have these set, check the project's `.env` or `.env.local` files first.

## CLI Location

All tools live at `/Users/bdmorin/src/linq-antimcp/src/cli/`. Run them with Bun from any directory:

```bash
bun /Users/bdmorin/src/linq-antimcp/src/cli/<tool>.ts [args]
```

## Tools

### linq-send — Send a text message

The workhorse. Send text, attach images, apply iMessage effects, thread replies.

```bash
# Simple text
bun /Users/bdmorin/src/linq-antimcp/src/cli/send.ts "Deploy complete. All tests passing."

# Pipe content from stdin (great for sending command output)
git log --oneline -5 | bun /Users/bdmorin/src/linq-antimcp/src/cli/send.ts

# Typed prefix (adds [ALERT], [STATUS], [INFO] tag)
bun /Users/bdmorin/src/linq-antimcp/src/cli/send.ts --type alert "Build failed on main"
bun /Users/bdmorin/src/linq-antimcp/src/cli/send.ts --type status "Research pipeline complete: 7 new entries"

# Attach an image (uploaded via pre-signed URL, up to 100MB)
bun /Users/bdmorin/src/linq-antimcp/src/cli/send.ts --image ./screenshot.png "Here's the current state"

# iMessage effects
bun /Users/bdmorin/src/linq-antimcp/src/cli/send.ts --effect confetti "All tests passing!"

# Thread a reply to a specific message
bun /Users/bdmorin/src/linq-antimcp/src/cli/send.ts --reply-to <message-uuid> "Fixed that issue"

# Send to a different chat
bun /Users/bdmorin/src/linq-antimcp/src/cli/send.ts --chat-id <uuid> "message"
```

**Flags:**
- `-t, --type <type>` — Prefix: `alert`, `status`, `info`
- `-i, --image <path>` — Attach image file (JPEG, PNG, GIF, HEIC, PDF, MP4, etc. — NOT WebP/SVG)
- `-e, --effect <name>` — iMessage effect: `confetti`, `fireworks`, `lasers`, `slam`, `loud`, `gentle`, `invisible`
- `--chat-id <id>` — Override `LINQ_CHAT_ID`
- `--reply-to <msg-id>` — Thread a reply
- `-s, --service <svc>` — Force service: `iMessage`, `RCS`, `SMS`, `auto`

**Output** (JSON on stdout):
```json
{"chat_id":"...","message_id":"...","service":"iMessage","delivery_status":"sent"}
```

### linq-voice — Send a voice memo

Converts text to speech via ElevenLabs, uploads the MP3 to Linq, and sends it as an iMessage audio bubble with native waveform. The human hears your voice.

Requires `ELEVENLABS_API_KEY` in addition to the Linq env vars.

```bash
# Speak a message
bun /Users/bdmorin/src/linq-antimcp/src/cli/voice.ts "I've finished the analysis. Three findings need your attention."

# Pipe longer content
cat summary.txt | bun /Users/bdmorin/src/linq-antimcp/src/cli/voice.ts

# Custom voice
bun /Users/bdmorin/src/linq-antimcp/src/cli/voice.ts --voice-id <elevenlabs-voice-id> "message"
```

**Flags:**
- `-v, --voice-id <id>` — ElevenLabs voice (default: Rachel)
- `-m, --model-id <model>` — TTS model (default: `eleven_multilingual_v2`)
- `-c, --chat-id <id>` — Override `LINQ_CHAT_ID`
- `--stability <n>` — Voice stability 0.0-1.0 (default: 0.5)
- `--boost <n>` — Similarity boost 0.0-1.0 (default: 0.75)

**Output** (JSON on stdout):
```json
{"ok":true,"message_id":"...","service":"iMessage","audio_bytes":113311,"text_chars":85}
```

### linq-react — Add a reaction to a message

Tapback reactions on messages — the iMessage heart, thumbs up, etc.

```bash
# Love a message
bun /Users/bdmorin/src/linq-antimcp/src/cli/react.ts --message-id <uuid> --type love

# Custom emoji reaction
bun /Users/bdmorin/src/linq-antimcp/src/cli/react.ts -m <uuid> -t custom -e "🔥"

# Remove a reaction
bun /Users/bdmorin/src/linq-antimcp/src/cli/react.ts -m <uuid> -t like --remove
```

**Reaction types:** `love`, `like`, `dislike`, `laugh`, `emphasize`, `question`, `custom`

### linq-typing — Show typing indicator

Let the human know you're working on something. Start when processing, stop when done.

```bash
bun /Users/bdmorin/src/linq-antimcp/src/cli/typing.ts --start
bun /Users/bdmorin/src/linq-antimcp/src/cli/typing.ts --stop
bun /Users/bdmorin/src/linq-antimcp/src/cli/typing.ts -c <chat-id> --start
```

### linq-probe — Check messaging capability

Check if a phone number supports iMessage or RCS before sending.

```bash
bun /Users/bdmorin/src/linq-antimcp/src/cli/probe.ts +1234567890
bun /Users/bdmorin/src/linq-antimcp/src/cli/probe.ts --service imessage +1234567890
```

**Output:** `{"phone":"+1234567890","imessage":true,"rcs":false}`

### linq-numbers — Health check

Lists assigned phone numbers. Also validates your API credentials are working.

```bash
bun /Users/bdmorin/src/linq-antimcp/src/cli/numbers.ts
```

## Exit Codes

All tools follow the same contract. Use these to decide whether to retry:

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Message sent |
| 1 | Permanent failure | Bad request or auth error — don't retry |
| 2 | Transient failure | Server error or timeout — retry with backoff |
| 3 | Config error | Missing env vars — check your configuration |
| 4 | Rate limited | Back off and retry after delay |

## When to Use Each Tool

| Situation | Tool | Example |
|-----------|------|---------|
| Report status or findings | `send` | "Pipeline complete: 12 entries processed, 3 new findings" |
| Alert on failure | `send --type alert` | "Build failed on main — test suite has 4 failures" |
| Share visual evidence | `send --image` | Screenshot of dashboard, chart, error page |
| Explain something complex | `voice` | Detailed analysis the human can listen to while walking |
| Acknowledge a message | `react` | Heart or thumbs-up on a received instruction |
| Signal you're working | `typing --start` | Show typing bubble while processing a long task |
| Celebrate | `send --effect confetti` | All tests passing, deploy successful |

## Composing Multi-Part Messages

Send text + image together:
```bash
bun /Users/bdmorin/src/linq-antimcp/src/cli/send.ts --image ./chart.png "Here's the performance comparison"
```

For multiple images, send separate messages — each `--image` flag handles one file.

## Routing Logic

The tools handle routing automatically:
1. If `LINQ_CHAT_ID` is set, sends to existing chat
2. If that chat returns 404, falls back to creating a new chat using `LINQ_RECIPIENT_NUMBER`
3. If neither is set, exits with code 3

For most agents, `LINQ_CHAT_ID` is pre-set and never changes.

## Supported Media Formats

**Accepted:** JPEG, PNG, GIF, HEIC, HEIF, TIFF, BMP, MP4, MOV, PDF, Office docs, VCF, ICS
**Rejected:** WebP, SVG, executables

Max size: 100MB per attachment. `attachment_id` is reusable forever — send the same image to multiple chats without re-uploading.
