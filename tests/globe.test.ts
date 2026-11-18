import assert from "node:assert/strict";
import test from "node:test";
import { europeBorderAlpha, europeLabelAlpha, isFacing, isInView, isOnScreen, largestNearbySpan, projectionCenter } from "../lib/globe.ts";

const radiusAt = (scale: number) => 294 * scale;
const france = 0.154;
const belgium = 0.043;

test("a continent on the far side is hidden", () => {
  const [centerLng, centerLat] = projectionCenter([-18, -4]);
  assert.equal(isFacing(18, 4, centerLng, centerLat), true);
  assert.equal(isFacing(134, -25, centerLng, centerLat), false);
});

test("a country on the far side is left out of the zoomed-in draw", () => {
  const [centerLng, centerLat] = projectionCenter([-12, -22]);
  assert.equal(isOnScreen(10, 50, 0.15, centerLng, centerLat), true);
  assert.equal(isOnScreen(134, -25, 0.4, centerLng, centerLat), false);
});

test("zoomed in, a distant front-side country is not drawn", () => {
  assert.equal(isInView(-100, 40, 0.4, 10, 50, 300, 450), true);
  assert.equal(isInView(-100, 40, 0.4, 10, 50, 1800, 450), false);
  assert.equal(isInView(10, 50, 0.15, 10, 50, 1800, 450), true);
});

test("turning the globe toward Australia hides Africa", () => {
  const [centerLng, centerLat] = projectionCenter([-134, 25]);
  assert.equal(isFacing(134, -25, centerLng, centerLat), true);
  assert.equal(isFacing(18, 4, centerLng, centerLat), false);
});

test("a country label uses the mainland, not a closer islet", () => {
  const span = largestNearbySpan({ lng: 11.9, lat: 43.9 }, [
    { lng: 12.1, lat: 43.7, span: 0.002 },
    { lng: 12.5, lat: 42.5, span: 0.16 },
  ]);
  assert.equal(span, 0.16);
});

test("a small european country keeps its own size beside a large neighbor", () => {
  const span = largestNearbySpan({ lng: 4.7, lat: 50.6 }, [
    { lng: 4.6, lat: 50.5, span: 0.043 },
    { lng: 1.6, lat: 46.7, span: 0.154 },
  ]);
  assert.equal(span, 0.043);
});

test("european countries stay off the globe while you are still zoomed out", () => {
  assert.equal(europeBorderAlpha(france, radiusAt(1.4)), 0);
  assert.equal(europeLabelAlpha(france, radiusAt(2.1)), 0);
  assert.equal(europeBorderAlpha(belgium, radiusAt(2.6)), 0);
});

test("zooming in makes larger european countries visible before the smaller ones", () => {
  const radius = radiusAt(2.7);
  assert.ok(europeBorderAlpha(france, radius) > 0.45);
  assert.equal(europeBorderAlpha(belgium, radius), 0);
  assert.ok(europeLabelAlpha(france, radius) > europeLabelAlpha(belgium, radius));
});

test("european names stay visible as the zoom increases", () => {
  const closer = europeLabelAlpha(france, radiusAt(3.4));
  const further = europeLabelAlpha(france, radiusAt(6));
  assert.ok(closer > 0.5);
  assert.equal(further, 1);
  assert.ok(further >= closer);
});
