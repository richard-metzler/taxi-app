import { test } from "node:test";
import assert from "node:assert/strict";
import { getMapProviderConfig, MAP_PROVIDERS } from "../src/core/map-provider.ts";

test("картографические подложки: Яндекс (EPSG:3395), 2ГИС и Google Карты (EPSG:3857)", () => {
  const yandex = getMapProviderConfig("yandex");
  assert.equal(yandex.id, "yandex");
  assert.equal(yandex.crs, "EPSG3395");
  assert.match(yandex.tileUrl, /yandex\.net/);
  assert.match(yandex.attribution, /Яндекс/);

  const dgis = getMapProviderConfig("dgis");
  assert.equal(dgis.id, "dgis");
  assert.equal(dgis.crs, "EPSG3857");
  assert.match(dgis.tileUrl, /2gis\.com/);
  assert.match(dgis.attribution, /2ГИС/);

  const google = getMapProviderConfig("google");
  assert.equal(google.id, "google");
  assert.equal(google.crs, "EPSG3857");
  assert.match(google.tileUrl, /google\.com/);
  assert.match(google.attribution, /Google/);

  for (const cfg of Object.values(MAP_PROVIDERS)) {
    assert.doesNotMatch(cfg.tileUrl, /openstreetmap/i);
  }
});
