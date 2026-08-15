import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const KEY = 'toggle-snap';
const THRESHOLD = 5;

const KEY_LEFT = 105;
const KEY_RIGHT = 106;
const KEY_LEFTMETA = 125;

export default class SnapHalfToggleExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._createVirtualKeyboard();
        Main.wm.addKeybinding(
            KEY,
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => this._toggle());
    }

    disable() {
        if (this._settings) {
            Main.wm.removeKeybinding(KEY);
            this._settings = null;
        }
        if (this._virtualDevice) {
            this._virtualDevice.run_dispose();
            this._virtualDevice = null;
        }
    }

    _createVirtualKeyboard() {
        const seat = global.stage.context.get_backend().get_default_seat();
        if (!seat || typeof seat.create_virtual_device !== 'function')
            return;
        try {
            this._virtualDevice =
                seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        } catch (e) {
            console.debug('Virtual keyboard device unavailable', e);
        }
    }

    _sendKey(keycode, pressed) {
        if (!this._virtualDevice)
            return;
        this._virtualDevice.notify_key(
            Clutter.get_current_event_time() * 1000,
            keycode,
            pressed ? Clutter.KeyState.PRESSED : Clutter.KeyState.RELEASED);
    }

    _pressSuperArrow(arrowKeycode) {
        this._sendKey(KEY_LEFTMETA, true);
        this._sendKey(arrowKeycode, true);
        this._sendKey(arrowKeycode, false);
        this._sendKey(KEY_LEFTMETA, false);
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

        const atLeft = Math.abs(frame.x - work.x) <= THRESHOLD;
        this._pressSuperArrow(atLeft ? KEY_RIGHT : KEY_LEFT);
    }
}
