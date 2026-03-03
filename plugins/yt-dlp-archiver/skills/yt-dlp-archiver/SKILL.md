---
name: yt-dlp-archiver
description: >-
  Download and archive YouTube videos using yt-dlp. Triggers whenever a YouTube URL
  (youtube.com/watch, youtu.be, youtube.com/shorts, youtube.com/live) appears in the
  conversation. Downloads 480p video (sponsorblock-cleaned), transcript, description,
  thumbnail, chapter markers, and full metadata JSON — then auto-runs fabric analysis
  skills on the transcript. Use this skill any time the user pastes a YouTube link,
  asks to download a video, grab a transcript, archive a video, or mentions yt-dlp.
  Even if the user just drops a bare URL with no other context, this skill should fire.
---

# yt-dlp Video Archiver

Archive YouTube videos with full metadata extraction, then analyze the content with
fabric skills. Requires `yt-dlp` to be installed.

## Preflight

Before doing anything, verify yt-dlp exists:

```bash
which yt-dlp || { echo "ERROR: yt-dlp is not installed. Install it first: brew install yt-dlp"; exit 1; }
```

If yt-dlp is not found, stop and tell the user. Do not attempt to install it.

## Archive Directory Structure

All downloads go to `~/src/youtube-archive/` organized by date and video title:

```
~/src/youtube-archive/
  YYYYMMDD/
    YYYYMMDD-<sanitized-title>.mp4              # 480p video (sponsor segments removed)
    YYYYMMDD-<sanitized-title>.en.srt           # English subtitles (timecoded SRT)
    YYYYMMDD-<sanitized-title>.transcript.txt   # Clean transcript (no timestamps)
    YYYYMMDD-<sanitized-title>.description      # Video description
    YYYYMMDD-<sanitized-title>.info.json        # Full metadata JSON
    YYYYMMDD-<sanitized-title>.sponsorblock.json # SponsorBlock segment data
    YYYYMMDD-<sanitized-title>.jpg              # Thumbnail
    YYYYMMDD-<sanitized-title>.fabric.md        # Fabric analysis output (auto-generated)
    chapters/                                    # Chapter frame captures (if chapters exist)
      ch01-<chapter-title>.jpg
      ch02-<chapter-title>.jpg
```

The date folder uses today's date (the archive date), not the upload date.

## The Download Command

Run this as a single yt-dlp invocation. yt-dlp handles everything in one pass — do not
run multiple commands for the same video.

```bash
DATE=$(date +%Y%m%d)
mkdir -p ~/src/youtube-archive/$DATE

yt-dlp \
  -f "bestvideo[height<=480]+bestaudio/best[height<=480]" \
  --merge-output-format mp4 \
  --restrict-filenames \
  --write-auto-subs \
  --sub-lang "en" \
  --convert-subs srt \
  --write-description \
  --write-info-json \
  --write-thumbnail \
  --convert-thumbnails jpg \
  --sponsorblock-remove all \
  --embed-chapters \
  --no-playlist \
  --output "~/src/youtube-archive/$DATE/${DATE}-%(title)s.%(ext)s" \
  "<URL>"
```

### What each flag does

- `-f "bestvideo[height<=480]+bestaudio/best[height<=480]"` — caps video at 480p, grabs best audio
- `--merge-output-format mp4` — ensures final output is mp4 regardless of source streams
- `--restrict-filenames` — forces ASCII-safe filenames (replaces spaces with `_`, strips unicode)
- `--write-auto-subs --sub-lang en --convert-subs srt` — downloads auto-generated English captions as .srt
- `--write-description` — saves the video description as a .description text file
- `--write-info-json` — dumps the full metadata blob (title, channel, views, likes, duration, chapters, categories, tags, etc.)
- `--write-thumbnail --convert-thumbnails jpg` — grabs the thumbnail and converts to jpg
- `--sponsorblock-remove all` — removes sponsor segments, intros, outros, selfpromo from the actual video file
- `--embed-chapters` — bakes chapter markers into the mp4
- `--no-playlist` — if the URL is part of a playlist, only download this single video

## After Download

Once the download completes:

1. Report what was downloaded — list the files with sizes
2. Show a brief summary extracted from the info.json: title, channel, duration, upload date, view count, chapter count
3. If chapters exist, list them with timestamps
4. Run the Post-Processing Pipeline (next section)
5. Then proceed to the Fabric Analysis Pipeline

## Post-Processing Pipeline

Run these three steps after yt-dlp finishes but before fabric analysis.

### 1. Generate clean transcript

Strip SRT timestamps to produce a plain text transcript. The SRT format has: line
number, timestamp line, subtitle text, blank line. Extract only the text:

```bash
sed '/^[0-9][0-9]*$/d; /^[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/d; /^$/d' \
  "YYYYMMDD-<title>.en.srt" > "YYYYMMDD-<title>.transcript.txt"
```

If no `.en.srt` exists, skip this step. The fabric pipeline will use the
`.description` file instead.

Use the `.transcript.txt` (not the `.en.srt`) as input for the fabric analysis
pipeline. The clean transcript produces better analysis than timecoded subtitles.

### 2. Fetch SponsorBlock segment data

Query the SponsorBlock API to get segment data for the video. Extract the video ID
from the URL (the `v=` parameter or the path after `youtu.be/`):

```bash
VIDEO_ID="<extracted-video-id>"
curl -s "https://sponsor.ajay.app/api/skipSegments?videoID=${VIDEO_ID}&categories=%5B%22sponsor%22%2C%22selfpromo%22%2C%22interaction%22%2C%22intro%22%2C%22outro%22%2C%22preview%22%2C%22music_offtopic%22%2C%22filler%22%5D" \
  -o "YYYYMMDD-<title>.sponsorblock.json"
```

If the API returns a 404 (no segments found for this video), write an empty JSON
array `[]` to the file. Report a summary of what was found: segment count, total
removed duration, and segment types.

### 3. Extract chapter frame captures

If the info.json contains a `chapters` array, extract a single frame from the video
at each chapter's start time. Requires `ffmpeg` to be installed:

```bash
ffmpeg -ss <start_time_seconds> -i "YYYYMMDD-<title>.mp4" \
  -frames:v 1 -q:v 2 \
  "chapters/ch<NN>-<sanitized-chapter-title>.jpg"
```

Run this for each chapter. Create the `chapters/` subdirectory first. Sanitize
chapter titles the same way yt-dlp does (ASCII-safe, underscores for spaces).

If ffmpeg is not installed, skip this step and note it in the download report.
If no chapters exist, skip this step entirely.

## Fabric Analysis Pipeline

After downloading, chain fabric skills from the-no-shop marketplace against the
transcript to produce a `.fabric.md` file. Each fabric skill is a standalone SKILL.md
containing its own identity, steps, and output instructions — read each one and follow
its instructions against the transcript content.

### How chaining works

1. Read the `.transcript.txt` (or `.en.srt` if no txt, or `.description` if no transcript at all)
2. For each skill in the pipeline, find its SKILL.md using Glob with path set to
   the marketplace directory. Try these locations (first match wins):
   - Installed: `$HOME/.claude/plugins/marketplaces/the-no-shop/plugins/` with
     pattern `fabric-*/skills/<skill-name>/SKILL.md`
   - Local dev: working directory `plugins/` with same pattern
3. Read the skill's SKILL.md
4. Follow its IDENTITY/PURPOSE, STEPS, and OUTPUT INSTRUCTIONS sections against
   the transcript content
5. Write that skill's output as a section in the `.fabric.md` file
6. Move to the next skill in the chain

When applying each fabric skill, temporarily adopt its stated identity and follow
its instructions faithfully. Each skill's output is independent — do not let one
skill's framing influence the next.

### Core pipeline (always chain these)

Run these two fabric skills in order against every transcript:

| Order | Skill | Plugin | What it produces |
|-------|-------|--------|-----------------|
| 1 | summarize | fabric-summarization | ONE SENTENCE SUMMARY, MAIN POINTS, TAKEAWAYS |
| 2 | extract-wisdom | fabric-extraction | IDEAS, INSIGHTS, QUOTES, HABITS, FACTS, REFERENCES, ONE-SENTENCE TAKEAWAY, RECOMMENDATIONS |

### Content-aware chain additions

After reading the info.json, detect the content type and chain one additional
fabric skill from the analysis plugin:

| Content type | Detection signal | Skill (plugin: fabric-analysis) |
|-------------|-----------------|-------------------------------|
| Debate/politics | title/description contains "debate"; categories include "News & Politics" | analyze-debate |
| Presentation/talk | title contains "talk", "keynote", "presentation", "conference" | analyze-presentation |
| Academic/paper | categories include "Education", "Science & Technology"; lecture-style content | analyze-paper |

If the content doesn't match any of these types, skip the additional skill — the
core pipeline (summarize + extract-wisdom) is sufficient.

### Output file

Write all chained skill outputs to `YYYYMMDD-<title>.fabric.md` alongside the
other downloaded files.

#### File header (always include)

```markdown
# Fabric Analysis: <video title>

**Source**: <youtube URL>
**Channel**: <channel name>
**Duration**: <duration>
**Archived**: <today's date>
**Skills chained**: summarize, extract-wisdom[, additional-skill-name]
```

Then write each skill's output in order, using the section headers that each
skill's instructions specify.

### Formatting overrides

Each fabric skill has its own output formatting rules. Follow them, with these
overrides for consistency across the combined document:

- Use markdown headers (##) to separate each skill's output sections
- Do not repeat items across skills — if extract-wisdom produces quotes that
  summarize already covered, skip the duplicates
- Do not output meta-commentary about the chaining process — only the analysis

### If a fabric skill is not found

If the Glob search doesn't locate a skill's SKILL.md (the plugin isn't installed),
skip it and add a note at the bottom of the .fabric.md:
`<!-- Skill not found: <skill-name> — skipped -->`

### Music videos and copyrighted lyrics

When the video categories include "Music" or the content is primarily a music
video/song, the fabric pipeline will likely fail because the API content filter
blocks reproduction of copyrighted lyrics. In this case:

1. Skip transcript-based fabric analysis entirely
2. Run fabric skills on the `.description` file only
3. Note in the `.fabric.md` that analysis is description-only due to music content
4. Do not attempt to quote, summarize, or paraphrase song lyrics

This is an API-level constraint, not a bug — the content filter prevents copyrighted
lyric reproduction in model output.

### When transcript is unavailable

If no `.srt` was generated (video has no captions), run fabric skills on the
`.description` file instead. Note in the output that analysis is description-only.

## Audio-Only Mode

If the user says "just the audio", "mp3 only", "rip the audio", or similar — replace
the video download flags with:

```bash
yt-dlp \
  -x --audio-format mp3 \
  --restrict-filenames \
  --write-auto-subs \
  --sub-lang "en" \
  --convert-subs srt \
  --write-description \
  --write-info-json \
  --write-thumbnail \
  --convert-thumbnails jpg \
  --no-playlist \
  --output "~/src/youtube-archive/$DATE/${DATE}-%(title)s.%(ext)s" \
  "<URL>"
```

Skip `--sponsorblock-remove` and `--embed-chapters` for audio-only (not applicable to
mp3). Still run the fabric pipeline on the transcript.

## Handling Multiple URLs

If the user pastes multiple YouTube URLs in one message, process each one sequentially.
Each gets its own download in the same date folder.

## Error Handling

- **Age-restricted videos**: Some may require authentication. Tell the user and suggest `--cookies-from-browser chrome`
- **No auto-captions available**: Some videos have no captions at all. The download still succeeds — just note that no transcript was generated and fabric will use description-only
- **Geo-blocked**: Report the error, suggest VPN or `--geo-verification-proxy`
- **Live streams**: These won't have a fixed duration. Note this to the user and suggest `--live-from-start` if they want to capture it

## What NOT to do

- Do not attempt to install yt-dlp
- Do not download above 480p unless the user explicitly asks for higher quality
- Do not download entire playlists unless explicitly asked
- Do not run `--write-comments` by default (slow, API-heavy, usually not wanted)
- Do not skip the fabric pipeline — it runs automatically after every download
