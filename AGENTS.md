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
5. Прижать — это выставить `frame` равным соответствующей половине `workArea` по X и ширине; затем вызвать `Meta.Window.set_maximize_flags(Meta.MaximizeFlags.VERTICAL)` — окно становится в полную высоту монитора (панель рисуется поверх), WM-флаг `MAXIMIZED_VERTICALLY` выставлен, текущие bounds сохранены как `unmaximize bounds`. **В Mutter 18 `Meta.Window.maximize()` принимает 0 аргументов и выставляет оба флага (BOTH) — для вертикальной максимизации нужно вызывать `set_maximize_flags(Meta.MaximizeFlags.VERTICAL)`. Методы `maximize_vertically` / `maximize_horizontally` / `tile` / `untile` / `toggle_tiled_*` объявлены в typelib, но не забиндены в GJS — падают с `TypeError`.**

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

1. Открыть окно в центре экрана → `<Super>Left` → прижато к левой половине, высота = полная высота монитора (панель рисуется поверх), WM-флаг `MAXIMIZED_VERTICALLY` выставлен.
7. После `<Super>Left` нажать свой `Super+H` → окно возвращается к предыдущему не-максимизированному состоянию (вертикальная максимизация снимается, горизонтальное прижатие сохраняется).
2. Повторно `<Super>Left` → прижато к правой половине.
3. Сдвинуть окно чуть-чуть (не прижато) → `<Super>Left` → снова левая половина.
4. На втором мониторе: окно переезжает по логике только в пределах своего монитора.
5. Полноэкранное/диалоговое окно: хоткей игнорируется.
6. После выхода из suspend / смены мониторов — хоткей работает без рестарта.

## Что НЕ делать

- Не привязывать хоткеи без `GSettings` (хардкод запрещён).
- Не использовать `global.window_manager` напрямую — устарело.
- Не вызывать `window.maximize()`/`window.unmaximize()` — ломает логику «не прижат → прижать» (выставляют/снимают BOTH = fullscreen). Допустим только `set_maximize_flags(Meta.MaximizeFlags.VERTICAL)` после `move_resize_frame`.
- Не ресайзить, если окно в состоянии fullscreen (`Meta.WindowType.NORMAL` фильтра недостаточно — проверять `window.is_fullscreen()` отдельно).

## Полученные выводы

Гипотезы, проверенные в процессе разработки этого расширения, и финальные выводы. Каждый пункт — реальная ошибка, в которую можно вляпаться снова.

### 1. Gnome Shell 50 не поддерживает классический GJS-синтаксис

**Гипотеза:** `imports.gi.Meta` и `imports.ui.main` всё ещё работают в 50.x.

**Проверка:** типичное написание классического расширения упало с `SyntaxError: import declarations may only appear at top level of a module @ resource:///org/gnome/shell/ui/main.js:1:1`.

**Доказательство:** в `libshell-18.so` загрузка расширений идёт через `extensionModule = await import(extensionJs.get_uri())`, затем `new extensionModule.default({...metadata, dir, path})`. Сам `main.js` начинается с `import ... from 'gi://...'`. Классический global `imports` в шеле больше не существует.

**Вывод:** расширение — **ES-модуль** с `export default class X extends Extension`; импорты через `import X from 'gi://X'` и `import * as Main from 'resource:///org/gnome/shell/ui/main.js'`.

### 2. `disable && enable` НЕ перезагружает модуль расширения

**Гипотеза:** после правки `extension.js` достаточно `gnome-extensions disable UUID && gnome-extensions enable UUID`.

**Проверка:** после правки и disable+enable в журнале продолжали сыпаться те же ошибки, что и до правки — выполнялся старый код.

**Доказательство:** в `libshell-18.so` явно стоит:
```js
// The extension is now cached and it's impossible to load a different version
if (type === ExtensionType.PER_USER && extension.isImported)
    this._unloadedExtensions.set(uuid, extension.metadata.version);
```
И сообщение пользователю:
```
'A different version was loaded previously. You need to log out for changes to take effect.'
```

**Вывод:** ESM-модули кешируются через `await import()` и не перечитываются. После правки `extension.js` нужен **полный перезапуск шела**: Wayland — logout/login, X11 — `Alt+F2 r`.

### 3. `Meta.Display.get_work_area_for_monitor` не существует

**Гипотеза:** workArea берётся с дисплея: `display.get_work_area_for_monitor(idx)`.

**Проверка:** упало с `TypeError: display.get_work_area_for_monitor is not a function`.

**Доказательство:** в `Meta-18.typelib` присутствуют только:
- `meta_window_get_work_area_for_monitor`
- `meta_workspace_get_work_area_for_monitor`

`meta_display_get_work_area_for_monitor` — **отсутствует**. Метод живёт на `Meta.Window` и `Meta.Workspace`, не на `Meta.Display`.

**Вывод:** `win.get_work_area_for_monitor(monitorIdx)` или `global.workspace_manager.get_active_workspace().get_work_area_for_monitor(monitorIdx)`. `Meta.Display.get_monitor_geometry(idx)` — да, есть, но возвращает полный монитор без исключения панелей.

### 4. `Main.wm.addKeybinding` имеет порядок аргументов `(name, settings, flags, modes, handler)`

**Гипотеза:** классический порядок `(name, settings, flags, handler, modes)`.

**Проверка:** в современных примерах расширений и в `apps-menu@gnome-shell-extensions.gcampax.github.com` (поставляется с шелом) аргументы идут именно в порядке `modes, handler`.

**Доказательство:** в `libshell-18.so`:
```js
addKeybinding(name, settings, flags, modes, handler) {
    const action = global.display.add_keybinding(name, settings, flags, handler);
    if (action !== Meta.KeyBindingAction.NONE)
        this.allowKeybinding(name, modes);
}
```

**Вывод:** порядок `(name, settings, flags, modes, handler)`. Поменять местами — handler не зарегистрируется корректно.

### 5. `Meta.Window.maximize()` принимает 0 аргументов и ставит BOTH

**Гипотеза:** `win.maximize(Meta.MaximizeFlags.VERTICAL)` — стандартный путь для вертикальной максимизации.

**Проверка:** `JS WARNING: Too many arguments to method Meta.Window.maximize: expected 0, got 1`; окно становилось на весь экран (BOTH).

**Доказательство:** дизассемблер `meta_window_maximize` явно кладёт `esi = 3` (BOTH) и вызывает `set_maximize_flags(window, 3)`.

**Вывод:** `win.maximize()` без аргументов = `BOTH` = fullscreen. Для одного направления — `set_maximize_flags(Meta.MaximizeFlags.VERTICAL)` или `set_unmaximize_flags(Meta.MaximizeFlags.VERTICAL)`.

### 6. `maximize_vertically`/`maximize_horizontally`/`tile`/`untile`/`toggle_*` — phantom-методы

**Гипотеза:** раз `Meta-18.typelib` содержит имена `maximize_vertically`, `maximize_horizontally`, `tile`, `untile`, `toggle_maximized`, `toggle_tiled_left`, `toggle_tiled_right` — значит, они доступны.

**Проверка:** `TypeError: win.maximize_vertically is not a function`. Эмпирически через `Object.getOwnPropertyNames(Meta.Window.prototype)` в GJS-рантайме доступны только:
```
can_maximize, get_maximize_flags, is_fullscreen, is_maximized,
make_fullscreen, unmake_fullscreen, fullscreen,
maximize, set_maximize_flags, set_unmaximize_flags, unmaximize,
maximized_horizontally, maximized_vertically, get_tile_match
```
Никаких `maximize_vertically`, `tile`, `toggle_*` на инстансе нет.

**Доказательство:** в `libmutter-18.so` (`nm -D`) C-символ `meta_window_maximize_vertically` отсутствует. В typelib имена объявлены, но в GJS не забиндены.

**Вывод:** **не доверять строкам typelib** — метод может быть объявлен, но не забинден. Перед использованием проверять эмпирически через `Meta.Window.prototype` или `typeof win.method`. Реальные инструменты для максимизации по направлению — `set_maximize_flags(flag)` / `set_unmaximize_flags(flag)`.

### 7. Кастомные биндинги media-keys перехватывают хоткеи раньше шел-расширений

**Гипотеза:** если установить хоткей через `Main.wm.addKeybinding`, он будет работать.

**Проверка:** `Super+W` был связан через `org.gnome.settings-daemon.plugins.media-keys.custom-keybindings/custom8` на скрипт `toggleWindowMoveToScreenEdge.sh` — нажатие уходило туда, а в шел-расширение не доходило.

**Доказательство:** в `org.gnome.settings-daemon.plugins.media-keys` есть массив `custom-keybindings`, ссылки на `custom0..customN` с полями `binding`, `command`, `name`. Settings-daemon ловит нажатия по этим паттернам **до** того, как их получит gnome-shell/wm.

**Вывод:** перед выбором дефолтного хоткея выполнить `dconf dump /` и проверить, не пересекается ли с `org.gnome.settings-daemon.plugins.media-keys.*` и `org.gnome.desktop.wm.keybindings.*`. Если дефолт занят — либо менять дефолт расширения, либо просить пользователя снять конфликтующий биндинг.

### 8. Схема настроек читается из `schemas/` директории расширения

**Гипотеза:** как и в классическом GJS, нужно вручную копировать `.gschema.xml` в `~/.local/share/glib-2.0/schemas/` и компилировать там.

**Проверка:** оказалось, что в Mutter 18 `Extension.getSettings()` сам подгружает схему из `<extension_dir>/schemas/`. Дополнительная копия в `glib-2.0/schemas/` нужна только для CLI-команды `gsettings`.

**Доказательство:** в `libshell-18.so`:
```js
getSettings(schema) {
    schema ||= this.metadata['settings-schema'];
    const schemaDir = this.dir.get_child('schemas');
    const defaultSource = Gio.SettingsSchemaSource.get_default();
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir.get_path(), defaultSource, false);
    }
    ...
}
```

**Вывод:** `schemas/gschemas.compiled` внутри расширения — **обязателен** (его читает `getSettings()`). Копия в `~/.local/share/glib-2.0/schemas/` — опциональна, нужна только для удобства работы с `gsettings` из терминала. Текущий `install.sh` ставит в оба места — безвредно и удобно.

### 9. Сигнатура `window.move_resize_frame` — 5 аргументов

**Гипотеза:** стандартная `move_resize_frame(op, is_user_action, x, y, w, h)` — 6 аргументов.

**Проверка:** `move_resize_frame(false, x, y, w, h)` (5 аргументов) работает в 50.x; 6-аргументная версия падает.

**Доказательство:** работающее расширение `putWindow@clemens.lab21.org` (совместимо с shell-version 49/50) использует `win.move_resize_frame(false, x, y, w, h)`.

**Вывод:** `(is_user_action, x, y, w, h)`. Первый аргумент — `false` (не user-action). Для совместимости с Mutter 18 — никакого `Meta.GrabOp` не нужно передавать.

### Сводка эмпирически подтверждённых методов `Meta.Window`

```
can_maximize, is_maximized, is_fullscreen
get_maximize_flags, get_tile_match
maximized_horizontally, maximized_vertically, fullscreen          ← геттеры
maximize               ← без аргументов, BOTH
unmaximize             ← без аргументов, снимает BOTH
set_maximize_flags     ← (Meta.MaximizeFlags) — то что нужно
set_unmaximize_flags   ← (Meta.MaximizeFlags)
make_fullscreen, unmake_fullscreen
move_resize_frame      ← (false, x, y, w, h) — 5 аргументов
get_frame_rect, get_buffer_rect, get_monitor
get_work_area_for_monitor, get_work_area_current_monitor, get_work_area_all_monitors
move_frame, resize_frame
```

Не забинжены в GJS (объявлены в typelib, но TypeError):
`maximize_vertically`, `maximize_horizontally`, `tile`, `untile`, `toggle_maximized`, `toggle_tiled_left`, `toggle_tiled_right`.
