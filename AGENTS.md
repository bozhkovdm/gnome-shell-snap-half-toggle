# AGENTS.md — snap-half-toggle

Расширение GNOME Shell: по хоткею прижимает активное окно к левой или правой половине экрана, попеременно.

- **UUID**: `snap-half-toggle@dmitry.github.io`
- **Целевая версия GNOME Shell**: 50.x (тестируется на 50.4)
- **Лицензия**: GPL-3.0-or-later
- **Язык**: GJS (JavaScript + `imports.gi`)

## Поведение

По нажатию **одного** хоткея (по умолчанию `<Super><Shift>Left` — см. секцию «Горячие клавиши») расширение само выбирает сторону прижатия:

1. Найти активное (фокусированное) окно пользователя. Если его нет — выйти.
2. Определить монитор окна (а не глобальный `primaryMonitor`).
3. Взять `workArea` этого монитора (без панелей и дока).
4. Сравнить `frame.x` окна с `workArea.x`:
   - если `|frame.x − workArea.x| <= THRESHOLD` (≤ 5 px) → прижать к **правой** половине;
   - иначе → прижать к **левой** половине.
5. Прижать — это выставить `frame` равным соответствующей половине `workArea` по X и ширине; высота — вся `workArea`; Y — `workArea.y`.

Окно остаётся на своём мониторе, не переезжает на другой.

Не учитываются:
- окна без фокуса;
- окна на полный экран (fullscreen) — `Meta.WindowType.NORMAL` фильтр;
- свёрнутые/на другом рабочем столе окна — игнорируем через `window.has_focus()` / `window.is_on_all_workspaces()` / `window.get_workspace() === global.workspace_manager.get_active_workspace()`.

## Структура проекта

```
.
├── AGENTS.md
├── snap-half-toggle@dmitry.github.io/
│   ├── metadata.json
│   ├── extension.js
│   └── schemas/
│       └── org.gnome.shell.extensions.snap-half-toggle.gschema.xml
└── scripts/
    ├── install.sh        # копирует расширение в ~/.local/share/gnome-shell/extensions
    └── uninstall.sh
```

Схема настроек обязательна: хоткеи должны настраиваться через `Gio.Settings` (без хоткодов в коде).

## Установка и dev-цикл

```sh
./scripts/install.sh                       # копирует файлы в ~/.local/share/gnome-shell/extensions
gnome-extensions enable snap-half-toggle@dmitry.github.io
# Перезагрузить shell:
#   Wayland: выйти из сессии и войти снова
#   X11:     Alt+F2 → r → Enter
```

После правок:

```sh
./scripts/install.sh                       # перекопировать
# затем перезагрузка shell (см. выше)
# ошибки читать в `journalctl -f -o short /usr/bin/gnome-shell` или в Looking Glass (Alt+F2 → lg)
```

Удаление:

```sh
./scripts/uninstall.sh
gnome-extensions disable snap-half-toggle@dmitry.github.io
```

## API-конвенции (Gnome Shell 50)

Gnome Shell 50 полностью перешёл на **ES modules**. Классический `imports.gi.*` / `imports.ui.*` **больше не работает**.

Импорты:

- `import Meta from 'gi://Meta';`
- `import Gio from 'gi://Gio';`
- `import Shell from 'gi://Shell';`
- `import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';`
- `import * as Main from 'resource:///org/gnome/shell/ui/main.js';`

Расширение — **ES-модуль**, экспортирующий класс по умолчанию:

```js
export default class MyExtension extends Extension {
    enable() { ... }
    disable() { ... }
}
```

Конструктор базы `Extension` принимает `{...metadata, dir, path}` и кладёт в `this.metadata`; `this.dir` — геттер, возвращающий `Gio.File` директории расширения; `this.uuid` — UUID.

Ключевые методы:

- `display.get_focus_window()` — текущее окно (может быть null).
- `window.get_frame_rect()` → `{ x, y, width, height }` — фрейм (включает заголовок).
- `window.get_monitor()` → индекс монитора; `display.get_monitor_geometry(idx)` — полный монитор; **`window.get_work_area_for_monitor(idx)`** — workArea с исключёнными панелями (метод живёт на `Meta.Window` / `Meta.Workspace`, не на `Meta.Display`).
- `window.move_resize_frame(is_user_action, x, y, w, h)` — единственный надёжный способ двигать. Передавать **координаты фрейма**, не клиентской области.
- `window.get_window_type()` → проверять `Meta.WindowType.NORMAL`.
- `Main.wm.addKeybinding(name, settings, flags, modes, handler)` — стандартный путь регистрации хоткея. **Порядок аргументов: `(name, settings, flags, modes, handler)`** — `modes` перед `handler`.
- `this.getSettings()` — настройки из `schemas/` директории расширения. Бросает, если схема не найдена.
- `global.display`, `global.workspace_manager`, `global.stage` — по-прежнему доступны.

## Хоткеи (GSettings)

Схема `org.gnome.shell.extensions.snap-half-toggle`:

- `toggle-snap` — переключатель. Дефолт: `<Super><Shift>Left`.

Одна привязка, одна функция-обработчик. Логика выбора стороны — внутри, как описано в «Поведение».

Хоткей регистрируется через `Main.wm.addKeybinding` с `Meta.KeyBindingFlags.IGNORE_AUTOREPEAT` и `Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW`.

## Стиль кода

- Без `console.log` в релизе — только `console.debug` (виден при `G_MESSAGES_DEBUG=all`).
- Никаких комментариев в JS-коде, если не запрошены явно.
- Минимум мутаций вне нужного окна; не трогать фокус пользователя без необходимости.
- Не использовать `setTimeout`/`setInterval` — для отложенных действий брать `Meta.later_add` или GLib.

## Тестирование

Автотестов нет. Ручной чек-лист (вписать результат в коммит/PR):

1. Открыть окно в центре экрана → `<Super>Left` → прижато к левой половине, высота = высота workArea, верх = верх workArea.
2. Повторно `<Super>Left` → прижато к правой половине.
3. Сдвинуть окно чуть-чуть (не прижато) → `<Super>Left` → снова левая половина.
4. На втором мониторе: окно переезжает по логике только в пределах своего монитора.
5. Полноэкранное/диалоговое окно: хоткей игнорируется.
6. После выхода из suspend / смены мониторов — хоткей работает без рестарта.

## Что НЕ делать

- Не привязывать хоткеи без `GSettings` (хардкод запрещён).
- Не использовать `global.window_manager` напрямую — устарело.
- Не вызывать `window.maximize()`/`unmaximize()` — ломает логику «не прижат → прижать».
- Не ресайзить, если окно в состоянии fullscreen (`Meta.WindowType.NORMAL` фильтра недостаточно — проверять `window.is_fullscreen()` отдельно).
