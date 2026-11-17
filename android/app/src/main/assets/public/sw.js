/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "87d39b1d6116bbccfee7726622e14812"
  }, {
    "url": "pwa-512x512.png",
    "revision": "87d39b1d6116bbccfee7726622e14812"
  }, {
    "url": "pwa-192x192.png",
    "revision": "692c420d2bbc264d9bd2d2c0ee96428b"
  }, {
    "url": "index.html",
    "revision": "ef8f4e683409d0ab29558e281d0110b1"
  }, {
    "url": "icon.svg",
    "revision": "f8eacca2a095f7fc72e6f403a09b7b2d"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "35c10ad7360f108733d923d9e00c20f2"
  }, {
    "url": "assets/vendor-react-CfasSphu.js",
    "revision": null
  }, {
    "url": "assets/vendor-leaflet-C1sF6AH5.css",
    "revision": null
  }, {
    "url": "assets/vendor-leaflet-BaxV0pCE.js",
    "revision": null
  }, {
    "url": "assets/vendor-icons-CnKhq82H.js",
    "revision": null
  }, {
    "url": "assets/rolldown-runtime-WkwZ5CU-.js",
    "revision": null
  }, {
    "url": "assets/index-CIRX2-QS.css",
    "revision": null
  }, {
    "url": "assets/index-BjmRk0ag.js",
    "revision": null
  }, {
    "url": "assets/SavedPlacesManager-huhHRdSr.js",
    "revision": null
  }, {
    "url": "assets/RoomsManager-DB_VyflW.js",
    "revision": null
  }, {
    "url": "assets/RemindersManager-C19CZs73.js",
    "revision": null
  }, {
    "url": "assets/ProfilePrivacyView-BCj4b4mM.js",
    "revision": null
  }, {
    "url": "assets/NotificationsCenter-r_VEHBav.js",
    "revision": null
  }, {
    "url": "assets/MeetingsManager-BWLDsptf.js",
    "revision": null
  }, {
    "url": "assets/FriendsView-DssjBshR.js",
    "revision": null
  }, {
    "url": "assets/ChatView-DACI1JvD.js",
    "revision": null
  }, {
    "url": "assets/AudioWaveformVisualizer-H6LAWvwa.js",
    "revision": null
  }, {
    "url": "assets/AdminDashboard-BfTT0BVR.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "35c10ad7360f108733d923d9e00c20f2"
  }, {
    "url": "icon.svg",
    "revision": "f8eacca2a095f7fc72e6f403a09b7b2d"
  }, {
    "url": "pwa-192x192.png",
    "revision": "692c420d2bbc264d9bd2d2c0ee96428b"
  }, {
    "url": "pwa-512x512.png",
    "revision": "87d39b1d6116bbccfee7726622e14812"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "87d39b1d6116bbccfee7726622e14812"
  }, {
    "url": "robots.txt",
    "revision": "453785449833473f4394d092d7e5b4f4"
  }, {
    "url": "manifest.webmanifest",
    "revision": "00dfeeb47f508f48c8267428a89840be"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/uploads\//, /^\/ws/, /^\/sitemap\.xml$/, /^\/robots\.txt$/]
  }));

}));
