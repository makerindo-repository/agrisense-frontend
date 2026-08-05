import { describe, it, expect } from 'vitest';
import { extractPolygonPositions } from '../../utils/mapUtils';

// ============================================================
// Unit Test: Map Utilities — Polygon Position Extraction
// ============================================================

describe('extractPolygonPositions', () => {
  it('should parse GeoJSON Polygon object', () => {
    const geojson = {
      type: 'Polygon',
      coordinates: [
        [
          [107.6, -6.9],
          [107.61, -6.9],
          [107.61, -6.91],
          [107.6, -6.91],
          [107.6, -6.9],
        ],
      ],
    };
    const result = extractPolygonPositions(geojson);
    expect(result.length).toBe(5);
    // GeoJSON is [lng, lat] → should swap to [lat, lng] based on Indonesia heuristic
    // abs(107.6) > 90, so it's longitude
    expect(result[0][0]).toBeCloseTo(-6.9);   // lat
    expect(result[0][1]).toBeCloseTo(107.6);   // lng
  });

  it('should parse GeoJSON Polygon as JSON string', () => {
    const geojsonStr = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [107.6, -6.9],
          [107.61, -6.9],
        ],
      ],
    });
    const result = extractPolygonPositions(geojsonStr);
    expect(result.length).toBe(2);
  });

  it('should parse simple array of [lat, lng] pairs', () => {
    const simpleArray = [
      [-6.9, 107.6],
      [-6.91, 107.61],
    ];
    const result = extractPolygonPositions(simpleArray);
    expect(result.length).toBe(2);
    // abs(-6.9) < 90, so first value is lat
    expect(result[0][0]).toBeCloseTo(-6.9);
    expect(result[0][1]).toBeCloseTo(107.6);
  });

  it('should parse array of {lat, lng} objects', () => {
    const objArray = [
      { lat: -6.9, lng: 107.6 },
      { lat: -6.91, lng: 107.61 },
    ];
    const result = extractPolygonPositions(objArray);
    expect(result.length).toBe(2);
    expect(result[0][0]).toBeCloseTo(-6.9);
    expect(result[0][1]).toBeCloseTo(107.6);
  });

  it('should parse array of {latitude, longitude} objects', () => {
    const objArray = [
      { latitude: -6.9, longitude: 107.6 },
      { latitude: -6.91, longitude: 107.61 },
    ];
    const result = extractPolygonPositions(objArray);
    expect(result.length).toBe(2);
  });

  it('should return empty array for invalid JSON string', () => {
    const result = extractPolygonPositions('not a valid json');
    expect(result).toEqual([]);
  });

  it('should return empty array for null input', () => {
    const result = extractPolygonPositions(null);
    expect(result).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    const result = extractPolygonPositions(undefined);
    expect(result).toEqual([]);
  });

  it('should filter out NaN coordinates', () => {
    const arrayWithNaN = [
      [-6.9, 107.6],
      ['abc', 'def'],   // will produce NaN
      [-6.91, 107.61],
    ];
    const result = extractPolygonPositions(arrayWithNaN);
    expect(result.length).toBe(2); // NaN pair filtered out
  });

  it('should apply Indonesia heuristic — swap when first coord > 90 (it is longitude)', () => {
    const geoJsonIndonesia = {
      type: 'Polygon',
      coordinates: [
        [
          [107.6, -6.9],   // GeoJSON: [lng, lat] — abs(107.6) > 90 → detected as lng
        ],
      ],
    };
    const result = extractPolygonPositions(geoJsonIndonesia);
    expect(result[0][0]).toBeCloseTo(-6.9);    // lat
    expect(result[0][1]).toBeCloseTo(107.6);   // lng
  });

  it('should NOT swap when first coord < 90 (it is latitude)', () => {
    const latFirstArray = [
      [-6.9, 107.6],   // abs(-6.9) < 90 → it's latitude, no swap
    ];
    const result = extractPolygonPositions(latFirstArray);
    expect(result[0][0]).toBeCloseTo(-6.9);
    expect(result[0][1]).toBeCloseTo(107.6);
  });
});
