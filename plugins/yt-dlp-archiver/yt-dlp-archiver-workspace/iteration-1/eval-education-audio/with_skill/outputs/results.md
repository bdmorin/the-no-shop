# yt-dlp-archiver Skill Evaluation: Education Audio-Only

**URL**: https://www.youtube.com/watch?v=aircAruvnKk
**Video**: But what is a neural network? | Deep learning chapter 1
**Channel**: 3Blue1Brown
**Duration**: 18:40
**Upload Date**: 2017-10-05
**Views**: 22,395,658
**Likes**: 530,070
**Category**: Education
**Mode**: Audio-only (MP3)
**Archive Date**: 2026-03-02

## Preflight

- yt-dlp found at: `/opt/homebrew/bin/yt-dlp`
- Status: PASS

## Download Mode

Audio-only mode triggered by user phrase "just the audio". Used `-x --audio-format mp3` flags per skill spec. Omitted `--sponsorblock-remove` and `--embed-chapters` per audio-only instructions.

## Output Files

| File | Size | Path |
|------|------|------|
| MP3 (audio) | 13,780,652 bytes (13.1 MB) | `~/src/youtube-archive/20260302/20260302-But_what_is_a_neural_network_Deep_learning_chapter_1.mp3` |
| Transcript (SRT) | 91,190 bytes (89.1 KB) | `~/src/youtube-archive/20260302/20260302-But_what_is_a_neural_network_Deep_learning_chapter_1.en.srt` |
| Description | 3,461 bytes (3.4 KB) | `~/src/youtube-archive/20260302/20260302-But_what_is_a_neural_network_Deep_learning_chapter_1.description` |
| Metadata (JSON) | 14,982,429 bytes (14.3 MB) | `~/src/youtube-archive/20260302/20260302-But_what_is_a_neural_network_Deep_learning_chapter_1.info.json` |
| Thumbnail (JPG) | 85,671 bytes (83.7 KB) | `~/src/youtube-archive/20260302/20260302-But_what_is_a_neural_network_Deep_learning_chapter_1.jpg` |
| Fabric Analysis (MD) | 8,576 bytes (8.4 KB) | `~/src/youtube-archive/20260302/20260302-But_what_is_a_neural_network_Deep_learning_chapter_1.fabric.md` |

**Total files**: 6
**Total size**: ~27.6 MB

## Chapters (12)

| Timestamp | Title |
|-----------|-------|
| 0:00 | Introduction example |
| 1:07 | Series preview |
| 2:42 | What are neurons? |
| 3:35 | Introducing layers |
| 5:31 | Why layers? |
| 8:38 | Edge detection example |
| 11:34 | Counting weights and biases |
| 12:30 | How learning relates |
| 13:26 | Notation and linear algebra |
| 15:17 | Recap |
| 16:27 | Some final words |
| 17:03 | ReLU vs Sigmoid |

## Fabric Analysis Pipeline

### Skills Executed

| Skill | Trigger | Status |
|-------|---------|--------|
| summarize | Default (always run) | COMPLETED |
| extract-wisdom | Default (always run) | COMPLETED |
| summarize-lecture | Content-aware: category="Education" | COMPLETED |

### Content Detection

- Category: "Education" -- triggered `summarize-lecture` skill
- Transcript source: `.en.srt` auto-generated captions (available)
- Analysis written to: `20260302-But_what_is_a_neural_network_Deep_learning_chapter_1.fabric.md`

## Skill Compliance Checklist

| Requirement | Status |
|-------------|--------|
| Preflight check (yt-dlp exists) | PASS |
| Archive directory structure (~/src/youtube-archive/YYYYMMDD/) | PASS |
| Audio-only flags (-x --audio-format mp3) | PASS |
| Omitted --sponsorblock-remove for audio | PASS |
| Omitted --embed-chapters for audio | PASS |
| --restrict-filenames | PASS |
| --write-auto-subs --sub-lang en --convert-subs srt | PASS |
| --write-description | PASS |
| --write-info-json | PASS |
| --write-thumbnail --convert-thumbnails jpg | PASS |
| --no-playlist | PASS |
| File listing with sizes reported | PASS |
| Metadata summary (title, channel, duration, etc.) | PASS |
| Chapters listed with timestamps | PASS |
| Fabric default analysis (summarize + extract-wisdom) | PASS |
| Fabric content-aware analysis (summarize-lecture) | PASS |
| Combined fabric output in .fabric.md | PASS |
