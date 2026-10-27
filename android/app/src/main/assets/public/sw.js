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
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
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
    "revision": "6ae0c296dbfc90964f3b71969e14facc"
  }, {
    "url": "icon.svg",
    "revision": "f8eacca2a095f7fc72e6f403a09b7b2d"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "35c10ad7360f108733d923d9e00c20f2"
  }, {
    "url": "assets/volume-2-BN3m5noi.js",
    "revision": null
  }, {
    "url": "assets/user-x-Bd3kcVDI.js",
    "revision": null
  }, {
    "url": "assets/radio-CyZku4b8.js",
    "revision": null
  }, {
    "url": "assets/log-out-DazKEdWi.js",
    "revision": null
  }, {
    "url": "assets/index-zxlb3aYZ.js",
    "revision": null
  }, {
    "url": "assets/index-MGAaSD2Z.css",
    "revision": null
  }, {
    "url": "assets/ToastContext-DWz2mPXe.js",
    "revision": null
  }, {
    "url": "assets/SavedPlacesManager-BD3xFEQn.js",
    "revision": null
  }, {
    "url": "assets/RoomsManager-RRZO10eE.js",
    "revision": null
  }, {
    "url": "assets/RemindersManager-Dmepxwzl.js",
    "revision": null
  }, {
    "url": "assets/ProfilePrivacyView-RAnNLAZz.js",
    "revision": null
  }, {
    "url": "assets/MeetingsManager-C4kGPD_P.js",
    "revision": null
  }, {
    "url": "assets/ChatView-Cs8T3Oow.js",
    "revision": null
  }, {
    "url": "assets/AdminDashboard-CwL96sIg.js",
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
    "url": "manifest.webmanifest",
    "revision": "8b76e68288f4e2c00dada8ce603b77c7"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/uploads\//, /^\/ws/]
  }));

}));
