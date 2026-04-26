# Checkers Game

A polished browser-based checkers game with two play modes:

- **vs Computer** — play against an AI opponent that uses a 2-ply lookahead with mandatory capture rules
- **vs Friend** — local two-player on the same device

## Features

- Full standard checkers rules
- Mandatory captures and multi-jump chains
- King promotion when reaching the back row
- Movable-piece highlighting and capture indicators
- Undo support
- Mobile-friendly responsive board
- Win detection (no pieces or no legal moves)

## Tech

Pure HTML, CSS, and JavaScript — no build step. Just open `index.html` or enable GitHub Pages.

## Controls

1. Click one of your pieces to select it
2. Highlighted squares show legal moves; rings show capture targets
3. If a capture is available anywhere, you must take it
4. Multi-jumps continue automatically until no more captures
