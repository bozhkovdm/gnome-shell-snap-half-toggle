import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const KEY = 'toggle-snap';
const THRESHOLD = 5;

export default class SnapHalfToggleExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        Main.wm.addKeybinding(
            KEY,
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._toggle());
    }

    disable() {
        if (this._settings) {
            Main.wm.removeKeybinding(KEY);
            this._settings = null;
        }
    }

    _pickWindow() {
        const win = global.display.get_focus_window();
        if (!win) return null;
        if (!win.has_focus()) return null;
        if (win.get_window_type() !== Meta.WindowType.NORMAL) return null;
        if (win.is_fullscreen()) return null;
        if (win.minimized) return null;
        const activeWs = global.workspace_manager.get_active_workspace();
        if (win.get_workspace() !== activeWs) return null;
        return win;
    }

    _toggle() {
        const win = this._pickWindow();
        if (!win) return;

        const monitorIdx = win.get_monitor();
        const work = win.get_work_area_for_monitor(monitorIdx);
        const frame = win.get_frame_rect();

        const halfW = Math.floor(work.width / 2);
        const atLeft = Math.abs(frame.x - work.x) <= THRESHOLD;

        const targetX = atLeft ? work.x + halfW : work.x;
        const targetY = work.y;
        const targetW = halfW;
        const targetH = work.height;

        win.move_resize_frame(false, targetX, targetY, targetW, targetH);
        win.set_maximize_flags(Meta.MaximizeFlags.VERTICAL);
    }
}
