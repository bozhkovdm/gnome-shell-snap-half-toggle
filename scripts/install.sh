#!/usr/bin/env bash
set -euo pipefail

UUID="snap-half-toggle@dmitry.github.io"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXT_SRC="$SRC_DIR/$UUID"
EXT_DST="$HOME/.local/share/gnome-shell/extensions/$UUID"
SCHEMAS_DIR="$EXT_SRC/schemas"

if [[ ! -d "$EXT_SRC" ]]; then
    echo "extension source not found: $EXT_SRC" >&2
    exit 1
fi

mkdir -p "$EXT_DST"
cp -r "$EXT_SRC/." "$EXT_DST/"

if [[ -f "$SCHEMAS_DIR/org.gnome.shell.extensions.snap-half-toggle.gschema.xml" ]]; then
    (cd "$SCHEMAS_DIR" && glib-compile-schemas .)
    (cd "$EXT_DST/schemas" && glib-compile-schemas .)
    mkdir -p "$HOME/.local/share/glib-2.0/schemas"
    cp "$SCHEMAS_DIR/org.gnome.shell.extensions.snap-half-toggle.gschema.xml" \
       "$HOME/.local/share/glib-2.0/schemas/"
    (cd "$HOME/.local/share/glib-2.0/schemas" && glib-compile-schemas .)
fi

echo "installed: $EXT_DST"
echo "next: gnome-extensions enable $UUID   # and reload shell (Wayland: re-login; X11: Alt+F2 → r)"
