#!/usr/bin/env python3
"""Regenerate the README screenshots and GIFs for Better Columns.

Run this locally against a development EspoCRM instance. It is not part of the
extension package.

Setup:
    pip install playwright pillow
    python -m playwright install chromium

Environment:
    ESPO_URL       EspoCRM base URL (default: http://127.0.0.1:8080)
    ESPO_USER      Login user (required)
    ESPO_PASSWORD  Login password (required)
    ESPO_ENTITY    List view to capture (default: Lead)

Usage:
    ESPO_USER=admin ESPO_PASSWORD=... python scripts/capture-readme.py
"""

import io
import os
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'screenshots'
VIEWPORT = {'width': 1000, 'height': 800}
GIF_WIDTH = 960
FRAME_MS = 120
HOLD_FRAMES = 5
TABLE = 'table.better-columns-managed-table'
MENU_BUTTON = '.better-columns-column-menu-button'
COLUMNS_TOGGLE = '.better-columns-settings-toggle'

FIND_SCROLLER_JS = """() => {
    let el = document.querySelector('table.better-columns-managed-table');

    while (el) {
        const style = getComputedStyle(el);

        if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth) {
            return el;
        }

        el = el.parentElement;
    }

    const table = document.querySelector('table.better-columns-managed-table');

    return [...document.querySelectorAll('*')].find(candidate => {
        const style = getComputedStyle(candidate);

        return /(auto|scroll)/.test(style.overflowX)
            && candidate.scrollWidth > candidate.clientWidth
            && candidate.contains(table);
    }) || null;
}"""

HEADER_NAMES_JS = """() => [...document.querySelectorAll(
    'thead th.field-header-cell[data-name]:not(.action-cell)'
)].map(th => th.dataset.name)"""


class Capture:
    def __init__(self, page):
        self.page = page
        self.frames = []

    def region(self, extra_bottom=0):
        table = self.page.locator(TABLE).bounding_box()
        pad = 12
        x = max(table['x'] - pad, 0)
        y = max(table['y'] - pad, 0)
        width = min(table['width'] + 2 * pad, VIEWPORT['width'] - x)
        height = min(
            table['height'] + 2 * pad + extra_bottom,
            VIEWPORT['height'] - y,
        )

        return {'x': x, 'y': y, 'width': width, 'height': height}

    def frame(self, extra_bottom=0):
        self.frames.append(
            self.page.screenshot(clip=self.region(extra_bottom))
        )

    def gif(self, name):
        if not self.frames:
            raise RuntimeError(f'No frames captured for {name}')

        images = [
            Image.open(io.BytesIO(data)).convert('RGB')
            for data in self.frames
        ]
        width = GIF_WIDTH
        height = round(images[0].height * width / images[0].width)
        frames = [
            img.resize((width, height), Image.LANCZOS).convert(
                'P', palette=Image.ADAPTIVE
            )
            for img in images
        ]
        durations = [FRAME_MS] * len(frames)
        durations[-1] = FRAME_MS * HOLD_FRAMES

        frames[0].save(
            OUT / name,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            optimize=True,
        )
        self.frames = []
        print(f'  wrote {name} ({len(frames)} frames)')


def login(page, url, user, password):
    page.goto(url)
    page.fill('input[name="username"]', user)
    page.fill('input[name="password"]', password)
    page.click('#btn-login')
    page.wait_for_selector('#main', timeout=60000)


def open_list(page, url, entity):
    page.goto(f'{url}/#{entity}')
    page.wait_for_selector(TABLE, timeout=60000)
    page.wait_for_timeout(800)
    page.locator(TABLE).scroll_into_view_if_needed()


def header_box(page, name):
    return page.locator(f'thead th[data-name="{name}"]').bounding_box()


def resizer_point(page, name):
    box = page.locator(
        f'thead th[data-name="{name}"] .better-columns-resizer'
    ).bounding_box()

    return box['x'] + box['width'] / 2, box['y'] + box['height'] / 2


def drag(page, cap, start, end, steps=12, extra_bottom=0):
    page.mouse.move(*start)
    page.mouse.down()

    for step in range(1, steps + 1):
        x = start[0] + (end[0] - start[0]) * step / steps
        y = start[1] + (end[1] - start[1]) * step / steps
        page.mouse.move(x, y)
        page.wait_for_timeout(30)
        cap.frame(extra_bottom)

    page.mouse.up()
    page.wait_for_timeout(200)

    for _ in range(HOLD_FRAMES):
        cap.frame(extra_bottom)


def open_columns_menu(page):
    page.click(COLUMNS_TOGGLE)
    page.wait_for_selector('[data-action="betterColumnsResetColumns"]')
    page.wait_for_timeout(200)


def fit_all_columns(page):
    open_columns_menu(page)
    page.click('[data-action="betterColumnsFitColumns"]')
    page.wait_for_timeout(800)
    close_menus(page)


def close_menus(page):
    page.keyboard.press('Escape')
    page.mouse.move(VIEWPORT['width'] - 4, VIEWPORT['height'] - 4)
    page.wait_for_timeout(200)


def reset_layout(page):
    open_columns_menu(page)
    page.click('[data-action="betterColumnsResetColumns"]')
    page.wait_for_timeout(800)


def open_column_menu(page, name):
    header = f'thead th[data-name="{name}"]'

    page.locator(header).evaluate(
        'el => el.scrollIntoView({block: "center", inline: "nearest"})'
    )
    page.hover(header)
    page.wait_for_timeout(150)
    page.locator(f'{header} {MENU_BUTTON}').evaluate('el => el.click()')
    page.wait_for_selector('.better-columns-column-menu')
    page.wait_for_timeout(200)


def find_hideable_column(page, names):
    for name in names[1:]:
        open_column_menu(page, name)
        found = page.locator('[data-action="betterColumnsHideColumn"]').count() > 0
        close_menus(page)

        if found:
            return name

    raise RuntimeError('No hideable column found')


def scroll_table(page, cap, target, steps=12):
    scroller = page.evaluate_handle(FIND_SCROLLER_JS)
    start = scroller.evaluate('el => el.scrollLeft')

    for step in range(1, steps + 1):
        value = start + (target - start) * step / steps
        scroller.evaluate('(el, value) => { el.scrollLeft = value; }', value)
        page.wait_for_timeout(40)
        cap.frame()

    for _ in range(HOLD_FRAMES):
        cap.frame()


def capture_all(page):
    cap = Capture(page)

    print('Resetting to the admin default layout')
    reset_layout(page)
    close_menus(page)

    names = page.evaluate(HEADER_NAMES_JS)
    first, second = names[0], names[1]
    print(f'Columns: {names}')

    print('Resize drag')
    x, y = resizer_point(page, first)
    page.mouse.move(x, y)
    page.wait_for_timeout(200)
    page.mouse.down()
    page.mouse.move(x + 60, y, steps=6)
    page.wait_for_timeout(200)
    page.mouse.up()
    page.wait_for_timeout(200)

    x, y = resizer_point(page, first)
    cap.frame()
    drag(page, cap, (x, y), (x + 120, y))
    cap.gif('resize-column.gif')

    print('Auto-fit by double-click')
    x, y = resizer_point(page, second)
    cap.frame()
    page.mouse.dblclick(x, y)
    page.wait_for_timeout(300)
    for _ in range(HOLD_FRAMES * 2):
        cap.frame()
    cap.gif('autofit-column.gif')

    print('Fit all columns')
    open_columns_menu(page)
    cap.frame()
    page.click('[data-action="betterColumnsFitColumns"]')
    page.wait_for_timeout(800)
    for _ in range(HOLD_FRAMES * 2):
        cap.frame()
    cap.gif('fit-all-columns.gif')

    print('Reorder by drag')
    reset_layout(page)
    names = page.evaluate(HEADER_NAMES_JS)
    source = header_box(page, names[1])
    target = header_box(page, names[3])
    start = (source['x'] + 40, source['y'] + source['height'] / 2)
    end = (target['x'] + 40, target['y'] + target['height'] / 2)
    cap.frame()
    drag(page, cap, start, end, steps=16)
    cap.gif('reorder-column.gif')

    print('Pin column')
    reset_layout(page)
    fit_all_columns(page)
    pin_target = page.evaluate(HEADER_NAMES_JS)[0]
    open_column_menu(page, pin_target)
    cap.frame(extra_bottom=120)
    page.click('[data-action="betterColumnsTogglePin"]')
    page.wait_for_timeout(300)
    close_menus(page)
    for _ in range(HOLD_FRAMES):
        cap.frame()
    scroll_table(page, cap, 420)
    scroll_table(page, cap, 0)
    cap.gif('pin-column.gif')

    print('Hide column')
    hide_target = find_hideable_column(page, page.evaluate(HEADER_NAMES_JS))
    open_column_menu(page, hide_target)
    for _ in range(HOLD_FRAMES):
        cap.frame()
    page.click('[data-action="betterColumnsHideColumn"]')
    page.wait_for_timeout(500)
    close_menus(page)
    for _ in range(HOLD_FRAMES):
        cap.frame()
    cap.gif('hide-column.gif')

    print('Reset order, widths, pins and visibility')
    open_columns_menu(page)
    cap.frame(extra_bottom=340)
    page.click('[data-action="betterColumnsResetColumns"]')
    page.wait_for_timeout(800)
    for _ in range(HOLD_FRAMES * 2):
        cap.frame(extra_bottom=340)
    close_menus(page)
    cap.gif('reset-order-and-widths.gif')


def main():
    url = os.environ.get('ESPO_URL', 'http://127.0.0.1:8080').rstrip('/')
    user = os.environ.get('ESPO_USER')
    password = os.environ.get('ESPO_PASSWORD')
    entity = os.environ.get('ESPO_ENTITY', 'Lead')

    if not user or not password:
        sys.exit('Set ESPO_USER and ESPO_PASSWORD before running this script.')

    OUT.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
        page = context.new_page()

        try:
            login(page, url, user, password)
            open_list(page, url, entity)
            capture_all(page)
        finally:
            browser.close()

    print('Done.')


if __name__ == '__main__':
    main()
