#!/usr/bin/env bash
set -euo pipefail

UUID="snap-half-toggle@dmitry.github.io"
EXT_DST="$HOME/.local/share/gnome-shell/extensions/$UUID"
SCHEMA_FILE="$HOME/.local/share/glib-2.0/schemas/org.gnome.shell.extensions.snap-half-toggle.gschema.xml"

if gnome-extensions list --enabled 2>/dev/null | grep -qx "$UUID"; then
    gnome-extensions disable "$UUID" || true
fi

rm -rf "$EXT_DST"
rm -f "$SCHEMA_FILE"

if [[ -d "$HOME/.local/share/glib-2.0/schemas" ]]; then
    (cd "$HOME/.local/share/glib-2.0/schemas" && glib-compile-schemas . || true)
fi

echo "uninstalled: $UUID"
