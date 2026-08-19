import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const KEY = 'toggle-snap';
const KEY_THIRDS = 'toggle-thirds';
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
        Main.wm.addKeybinding(
            KEY_THIRDS,
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL,
            () => this._toggleThirds());
    }

    disable() {
        if (this._settings) {
            Main.wm.removeKeybinding(KEY);
            Main.wm.removeKeybinding(KEY_THIRDS);
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

    _toggleThirds() {
        const win = this._pickWindow();
        if (!win) return;

        const monitorIdx = win.get_monitor();
        const work = win.get_work_area_for_monitor(monitorIdx);
        const frame = win.get_frame_rect();

        const thirdW = Math.floor(work.width / 3);
        const slots = [work.x, work.x + thirdW, work.x + 2 * thirdW];

        let slot = 0;
        for (let i = 0; i < slots.length; i++) {
            if (Math.abs(frame.x - slots[i]) <= THRESHOLD) {
                slot = (i + 1) % slots.length;
                break;
            }
        }

        win.move_resize_frame(false, slots[slot], work.y, thirdW, work.height);
        win.set_unmaximize_flags(Meta.MaximizeFlags.HORIZONTAL);
        win.set_maximize_flags(Meta.MaximizeFlags.VERTICAL);
    }
}
