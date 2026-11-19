import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getDraggedPosition,
    getScrollMetrics,
    toScrollLeft,
} from '../files/client/custom/modules/better-columns/src/utils/scroll-metrics.js';

test('a list that fits shows no hint and no thumb', () => {
    const metrics = getScrollMetrics({
        scrollLeft: 0,
        scrollWidth: 1000,
        clientWidth: 1000,
        trackWidth: 1000,
    });

    assert.equal(metrics.overflows, false);
    assert.equal(metrics.canScrollStart, false);
    assert.equal(metrics.canScrollEnd, false);
    assert.equal(metrics.thumbWidth, 0);
});

test('sub-pixel overflow is ignored', () => {
    const metrics = getScrollMetrics({
        scrollLeft: 0,
        scrollWidth: 1000.6,
        clientWidth: 1000,
        trackWidth: 1000,
    });

    assert.equal(metrics.overflows, false);
    assert.equal(metrics.canScrollEnd, false);
});

test('at the start only the end hint shows', () => {
    const metrics = getScrollMetrics({
        scrollLeft: 0,
        scrollWidth: 2000,
        clientWidth: 1000,
        trackWidth: 1000,
    });

    assert.equal(metrics.overflows, true);
    assert.equal(metrics.canScrollStart, false);
    assert.equal(metrics.canScrollEnd, true);
    assert.equal(metrics.thumbWidth, 500);
    assert.equal(metrics.thumbOffset, 0);
});

test('in the middle both hints show and the thumb follows', () => {
    const metrics = getScrollMetrics({
        scrollLeft: 500,
        scrollWidth: 2000,
        clientWidth: 1000,
        trackWidth: 1000,
    });

    assert.equal(metrics.canScrollStart, true);
    assert.equal(metrics.canScrollEnd, true);
    assert.equal(metrics.thumbOffset, 250);
});

test('at the end only the start hint shows', () => {
    const metrics = getScrollMetrics({
        scrollLeft: 1000,
        scrollWidth: 2000,
        clientWidth: 1000,
        trackWidth: 1000,
    });

    assert.equal(metrics.canScrollStart, true);
    assert.equal(metrics.canScrollEnd, false);
    assert.equal(metrics.thumbOffset, 500);
});

test('right-to-left negative scrollLeft is read as a distance from the start', () => {
    const metrics = getScrollMetrics({
        scrollLeft: -500,
        scrollWidth: 2000,
        clientWidth: 1000,
        trackWidth: 1000,
    });

    assert.equal(metrics.position, 500);
    assert.equal(metrics.thumbOffset, 250);
    assert.equal(toScrollLeft(500, true), -500);
    assert.equal(toScrollLeft(500, false), 500);
});

test('very wide lists keep a usable thumb', () => {
    const metrics = getScrollMetrics({
        scrollLeft: 0,
        scrollWidth: 100000,
        clientWidth: 1000,
        trackWidth: 1000,
        minimumThumbWidth: 32,
    });

    assert.equal(metrics.thumbWidth, 32);
});

test('dragging the thumb maps the track travel onto the scroll range', () => {
    const geometry = {maxScroll: 1000, trackWidth: 1000, thumbWidth: 500};

    assert.equal(getDraggedPosition(0, 250, geometry), 500);
    assert.equal(getDraggedPosition(0, 250, geometry, true), 0);
    assert.equal(getDraggedPosition(500, -250, geometry, true), 1000);
    assert.equal(getDraggedPosition(900, 400, geometry), 1000);
    assert.equal(getDraggedPosition(100, -400, geometry), 0);
    assert.equal(
        getDraggedPosition(0, 10, {maxScroll: 0, trackWidth: 1000, thumbWidth: 1000}),
        0
    );
});
