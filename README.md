# Snap Half Toggle

GNOME Shell extension that snaps the focused window to the left or right half of its monitor using a single hotkey. Pressing the hotkey on a left-snapped window toggles to the right, and vice versa.

- **UUID**: `snap-half-toggle@dmitry.github.io`
- **Target**: GNOME Shell 50.x (tested on 50.4)
- **License**: GPL-3.0-or-later

## How it works

1. The hotkey is pressed.
2. The focused user window is resolved (focused, `NORMAL` type, not fullscreen, not minimized, on the active workspace).
3. The window's monitor and `workArea` (excluding panels and docks) are read.
4. If the window's `frame.x` is within 5 px of `workArea.x`, it is snapped to the **right** half. Otherwise to the **left**.
5. `move_resize_frame` positions the window and `set_maximize_flags(Meta.MaximizeFlags.VERTICAL)` sets it to full monitor height with the `MAXIMIZED_VERTICALLY` flag.

The window stays on its own monitor and never crosses into another.

Ignored windows: anything without focus, fullscreen windows, dialogs/modals, minimized windows, and windows on a non-active workspace.

## Hotkey

| Key | Setting |
|---|---|
| `toggle-snap` | default: `<Super>w` |

Configurable through `Gio.Settings` (no hardcoded hotkeys). Change it with `gnome-extensions prefs snap-half-toggle@dmitry.github.io` or:

```sh
gsettings set org.gnome.shell.extensions.snap-half-toggle toggle-snap "['<Super><Shift>Left']"
```

## Install

```sh
./scripts/install.sh
gnome-extensions enable snap-half-toggle@dmitry.github.io
```

Then reload the shell:

- **Wayland**: log out and back in
- **X11**: `Alt+F2` → `r` → `Enter`

After any code or schema change, re-run `./scripts/install.sh` and reload the shell again — GNOME caches ESM modules, so `disable && enable` will not pick up edits to `extension.js` until the shell restarts.

## Uninstall

```sh
./scripts/uninstall.sh
gnome-extensions disable snap-half-toggle@dmitry.github.io
```

## Project layout

```
.
├── AGENTS.md                                       # dev notes / known pitfalls
├── README.md
├── snap-half-toggle@dmitry.github.io/
│   ├── metadata.json
│   ├── extension.js
│   └── schemas/
│       └── org.gnome.shell.extensions.snap-half-toggle.gschema.xml
└── scripts/
    ├── install.sh
    └── uninstall.sh
```

## Debugging

```sh
journalctl -f -o short /usr/bin/gnome-shell
```

or in-shell: `Alt+F2` → `lg` (Looking Glass) → Errors tab.

## Manual test checklist

1. Window centered → hotkey → snaps to left, full monitor height, `MAXIMIZED_VERTICALLY` set.
2. Press hotkey again → snaps to right.
3. Move window slightly off the snapped edge → hotkey → snaps back to left.
4. Second monitor: window only moves within its own monitor.
5. Fullscreen or dialog window: hotkey is ignored.
6. After suspend / monitor change: hotkey still works without restart.