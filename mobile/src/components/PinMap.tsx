/**
 * Tap-to-drop pin map (FR-3.1), rendered with Leaflet over OpenStreetMap tiles.
 *
 * D-5 resolved to **OSM tiles (free)** over the Google Maps SDK: it needs no API
 * key, no billing, and no per-platform native map provider. We render it with
 * Leaflet inside a WebView rather than pulling in a native map module — the only
 * runtime cost is the tile/library fetch, which a map needs a network for anyway,
 * and it keeps the dependency surface to the (Expo-supported) `react-native-webview`.
 *
 * Data flow is one-directional for position to avoid feedback loops: the WebView
 * owns the marker while editing and reports moves up via `onMove`; the parent owns
 * the radius and pushes it down by injecting JS. The marker is draggable and the
 * map is tap-to-move, satisfying "drop / move a pin".
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useThemedStyles, type ThemeColors } from '../lib/colors';
import type { LatLng } from '../lib/geofencing/types';

interface PinMapProps {
  /** Where to centre the map and drop the initial marker. */
  readonly center: LatLng;
  /** Current ring radius in metres; drives the circle overlay. */
  readonly radiusM: number;
  /** Called whenever the user taps or drags the pin to a new position. */
  readonly onMove: (position: LatLng) => void;
}

/**
 * Self-contained Leaflet document. The numbers are interpolated once at mount;
 * later radius changes arrive via `injectJavaScript` calling `window.setRadius`.
 * Marker moves (tap or drag) post a `{lat,lng}` message back to React Native.
 */
function buildHtml(center: LatLng, radiusM: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    #map { background: #e6f4fe; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${center.latitude};
    var lng = ${center.longitude};
    var radius = ${radiusM};

    var map = L.map('map', { zoomControl: true, attributionControl: true })
      .setView([lat, lng], 16);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    var circle = L.circle([lat, lng], { radius: radius, color: '#1f6feb', fillColor: '#1f6feb', fillOpacity: 0.15 }).addTo(map);

    function post(latlng) {
      circle.setLatLng(latlng);
      window.ReactNativeWebView &&
        window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lng: latlng.lng }));
    }

    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      post(e.latlng);
    });
    marker.on('dragend', function () {
      post(marker.getLatLng());
    });

    // Called from React Native when the radius preset changes.
    window.setRadius = function (r) {
      radius = r;
      circle.setRadius(r);
    };
  </script>
</body>
</html>`;
}

export function PinMap({ center, radiusM, onMove }: PinMapProps) {
  const styles = useThemedStyles(makeStyles);
  const webRef = useRef<WebView>(null);
  // Freeze the initial document so prop changes don't reload the map (which would
  // reset zoom/pan). The marker starts at `center`; later updates are injected.
  const [html] = useState(() => buildHtml(center, radiusM));

  // Push radius changes into the live map without a reload. The initial value is
  // already baked into `html`, so this only fires on subsequent changes.
  useEffect(() => {
    webRef.current?.injectJavaScript(
      `window.setRadius && window.setRadius(${radiusM}); true;`,
    );
  }, [radiusM]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const { lat, lng } = JSON.parse(event.nativeEvent.data) as {
        lat: number;
        lng: number;
      };
      if (typeof lat === 'number' && typeof lng === 'number') {
        onMove({ latitude: lat, longitude: lng });
      }
    } catch {
      // Ignore malformed messages — the map keeps its last good position.
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleMessage}
        // Tiles + Leaflet load over the network, same as any map needs.
        javaScriptEnabled
        domStorageEnabled
        style={styles.web}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  web: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },
});
