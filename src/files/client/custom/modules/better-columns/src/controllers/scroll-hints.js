import {
    getDraggedPosition,
    getScrollMetrics,
    toScrollLeft,
} from 'better-columns:utils/scroll-metrics';

/**
 * Makes horizontal overflow visible from anywhere in a long list:
 * - fading edges on the sides where columns are hidden;
 * - a scrollbar that sticks to the bottom of the viewport while the list
 *   extends below it, and takes the native scrollbar's place under the table
 *   otherwise.
 */
export default class ScrollHintsController {

    constructor() {
        this.listElement = null;
        this.table = null;
        this.edges = null;
        this.scrollbar = null;
        this.thumb = null;
        this.metrics = null;
        this.trackWidth = 0;
        this.hasPinned = false;
        this.drag = null;
        this.resizeObserver = null;
        this.frame = null;

        this.updateScrollBind = this.updateScroll.bind(this);
        this.scheduleUpdateBind = this.scheduleUpdate.bind(this);
        this.onScrollbarPointerDownBind = this.onScrollbarPointerDown.bind(this);
        this.onThumbPointerMoveBind = this.onThumbPointerMove.bind(this);
        this.onThumbPointerUpBind = this.onThumbPointerUp.bind(this);
        this.onScrollbarWheelBind = this.onScrollbarWheel.bind(this);
    }

    /**
     * @param {HTMLElement|null} listElement
     * @param {HTMLTableElement|null} table
     */
    attach(listElement, table) {
        if (!listElement || !table) {
            this.detach();

            return;
        }

        if (this.listElement !== listElement || this.table !== table) {
            this.detach();
            this.listElement = listElement;
            this.table = table;
            listElement.addEventListener('scroll', this.updateScrollBind, {
                passive: true,
            });

            if (window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(this.scheduleUpdateBind);
                this.resizeObserver.observe(listElement);
                this.resizeObserver.observe(table);
            } else {
                window.addEventListener('resize', this.scheduleUpdateBind);
            }
        }

        this.ensureElements();
        this.update();
    }

    ensureElements() {
        const list = this.listElement;

        if (!this.edges || this.edges.parentElement !== list) {
            this.edges?.remove();
            this.edges = document.createElement('div');
            this.edges.className = 'better-columns-scroll-edges';
            this.edges.setAttribute('aria-hidden', 'true');
            this.edges.innerHTML = [
                '<div class="better-columns-scroll-edge better-columns-scroll-edge-start"></div>',
                '<div class="better-columns-scroll-edge better-columns-scroll-edge-end"></div>',
            ].join('');
            list.prepend(this.edges);
        }

        if (
            !this.scrollbar ||
            this.scrollbar.previousElementSibling !== list
        ) {
            this.removeScrollbar();
            this.scrollbar = document.createElement('div');
            this.scrollbar.className = 'better-columns-scrollbar';
            this.scrollbar.setAttribute('aria-hidden', 'true');
            this.scrollbar.hidden = true;
            this.thumb = document.createElement('div');
            this.thumb.className = 'better-columns-scrollbar-thumb';
            this.scrollbar.append(this.thumb);
            this.scrollbar.addEventListener(
                'pointerdown',
                this.onScrollbarPointerDownBind
            );
            this.scrollbar.addEventListener('wheel', this.onScrollbarWheelBind, {
                passive: false,
            });
            list.after(this.scrollbar);
        }
    }

    scheduleUpdate() {
        if (this.frame !== null) {
            return;
        }

        this.frame = window.requestAnimationFrame(() => {
            this.frame = null;
            this.update();
        });
    }

    /**
     * Full refresh after attach, layout or resize: geometry, then scroll state.
     * Scrolling itself only needs updateScroll().
     */
    update() {
        const list = this.listElement;

        if (!list?.isConnected || !this.table || !this.scrollbar) {
            return;
        }

        const {overflows} = getScrollMetrics({
            scrollLeft: list.scrollLeft,
            scrollWidth: list.scrollWidth,
            clientWidth: list.clientWidth,
        });

        // Pinned columns already cast a shadow once the list is scrolled.
        this.hasPinned = Boolean(
            this.table.querySelector(':scope > thead > tr > .better-columns-pinned')
        );
        list.classList.toggle('better-columns-has-scrollbar', overflows);
        this.edges?.style.setProperty(
            '--better-columns-scroll-edge-height',
            `${this.table.offsetHeight}px`
        );
        this.scrollbar.hidden = !overflows;

        if (overflows) {
            this.placeScrollbar();
        }

        this.trackWidth = overflows ? this.scrollbar.clientWidth : 0;
        this.updateScroll();
    }

    /**
     * Aligns the bar with the list's visible box. Themes size and offset lists
     * in panels differently, so the box is measured rather than its margins copied.
     */
    placeScrollbar() {
        const parent = this.scrollbar.parentElement;

        if (!parent) {
            return;
        }

        const listRect = this.listElement.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        const parentStyle = getComputedStyle(parent);
        const offset = this.isRtl() ?
            parentRect.right -
                (parseFloat(parentStyle.borderRightWidth) || 0) -
                (parseFloat(parentStyle.paddingRight) || 0) -
                listRect.right :
            listRect.left -
                parentRect.left -
                (parseFloat(parentStyle.borderLeftWidth) || 0) -
                (parseFloat(parentStyle.paddingLeft) || 0);

        this.scrollbar.style.marginInlineStart = `${offset}px`;
        this.scrollbar.style.width = `${listRect.width}px`;
    }

    updateScroll() {
        const list = this.listElement;

        if (!list?.isConnected) {
            return;
        }

        this.metrics = getScrollMetrics({
            scrollLeft: list.scrollLeft,
            scrollWidth: list.scrollWidth,
            clientWidth: list.clientWidth,
            trackWidth: this.trackWidth,
        });
        this.metrics.trackWidth = this.trackWidth;

        list.classList.toggle(
            'better-columns-can-scroll-start',
            this.metrics.canScrollStart && !this.hasPinned
        );
        list.classList.toggle(
            'better-columns-can-scroll-end',
            this.metrics.canScrollEnd
        );

        if (this.thumb && this.metrics.thumbWidth) {
            this.thumb.style.width = `${this.metrics.thumbWidth}px`;
            this.thumb.style.insetInlineStart = `${this.metrics.thumbOffset}px`;
        }
    }

    isRtl() {
        return this.listElement ?
            getComputedStyle(this.listElement).direction === 'rtl' :
            false;
    }

    onScrollbarPointerDown(event) {
        if (!event.isPrimary || event.button !== 0 || !this.metrics?.overflows) {
            return;
        }

        event.preventDefault();

        if (event.target === this.thumb) {
            this.drag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startPosition: this.metrics.position,
                isRtl: this.isRtl(),
            };
            this.thumb.setPointerCapture?.(event.pointerId);
            this.thumb.addEventListener('pointermove', this.onThumbPointerMoveBind);
            this.thumb.addEventListener('pointerup', this.onThumbPointerUpBind);
            this.thumb.addEventListener('pointercancel', this.onThumbPointerUpBind);
            this.scrollbar.classList.add('is-dragging');

            return;
        }

        // A click on the track moves one page towards the click, like a native scrollbar.
        const thumbRect = this.thumb.getBoundingClientRect();
        const isRtl = this.isRtl();
        const forward = isRtl ?
            event.clientX < thumbRect.left :
            event.clientX > thumbRect.right;
        const step = this.listElement.clientWidth * 0.9;
        const reduceMotion = window.matchMedia?.(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        this.listElement.scrollBy({
            left: (forward ? step : -step) * (isRtl ? -1 : 1),
            behavior: reduceMotion ? 'auto' : 'smooth',
        });
    }

    onThumbPointerMove(event) {
        if (!this.drag || event.pointerId !== this.drag.pointerId || !this.metrics) {
            return;
        }

        const position = getDraggedPosition(
            this.drag.startPosition,
            event.clientX - this.drag.startX,
            this.metrics,
            this.drag.isRtl
        );

        this.listElement.scrollLeft = toScrollLeft(position, this.drag.isRtl);
    }

    onThumbPointerUp() {
        this.endDrag();
    }

    endDrag() {
        if (!this.drag) {
            return;
        }

        this.thumb?.releasePointerCapture?.(this.drag.pointerId);
        this.thumb?.removeEventListener('pointermove', this.onThumbPointerMoveBind);
        this.thumb?.removeEventListener('pointerup', this.onThumbPointerUpBind);
        this.thumb?.removeEventListener('pointercancel', this.onThumbPointerUpBind);
        this.scrollbar?.classList.remove('is-dragging');
        this.drag = null;
    }

    /**
     * A vertical wheel over the bar scrolls the list sideways instead of the page.
     */
    onScrollbarWheel(event) {
        if (!this.metrics?.overflows || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }

        event.preventDefault();

        const lineHeight = 16;
        const delta = event.deltaMode === 1 ? event.deltaY * lineHeight : event.deltaY;

        this.listElement.scrollLeft += this.isRtl() ? -delta : delta;
    }

    removeScrollbar() {
        this.endDrag();

        if (!this.scrollbar) {
            return;
        }

        this.scrollbar.removeEventListener(
            'pointerdown',
            this.onScrollbarPointerDownBind
        );
        this.scrollbar.removeEventListener('wheel', this.onScrollbarWheelBind);
        this.scrollbar.remove();
        this.scrollbar = null;
        this.thumb = null;
    }

    detach() {
        if (this.frame !== null) {
            window.cancelAnimationFrame(this.frame);
            this.frame = null;
        }

        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        window.removeEventListener('resize', this.scheduleUpdateBind);
        this.listElement?.removeEventListener('scroll', this.updateScrollBind);
        this.listElement?.classList.remove(
            'better-columns-can-scroll-start',
            'better-columns-can-scroll-end',
            'better-columns-has-scrollbar'
        );
        this.edges?.remove();
        this.edges = null;
        this.removeScrollbar();
        this.listElement = null;
        this.table = null;
        this.metrics = null;
        this.trackWidth = 0;
        this.hasPinned = false;
    }
}
