const cacheName = "PWA-v18";
const files = [
    "/download.js",
    "/hls.js@1.2.1",
    "/local_page.en-us.js",
    "/local_page.js",
    "/local_page.zh-cn.js",
    "/local_page_sw.js",
    "/unpkg.com_hyperlist@1.0.0_dist_hyperlist.js",
    "/local_video_player.buildme.html",
    "/local_video_player.en-us.html",
    "/local_video_player.zh-cn.html",
    "/local_videos.buildme.html",
    "/local_videos.en-us.html",
    "/local_videos.zh-cn.html",
    "/local_page.css"
]

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    event.waitUntil(
        caches.keys().then((keyList) => {
            console.log("keyList", keyList);
            return Promise.all(
                keyList.map((key) => {
                    if (key === cacheName) {
                        return;
                    }
                    return caches.delete(key);
                }),
            );
        }),
    );
});

self.addEventListener("install", (e) => {
    console.log("[Service Worker] Install");
    e.waitUntil(
        (async () => {
            const cache = await caches.open(cacheName);
            console.log("[Service Worker] Caching all: app shell and content");
            await cache.addAll(files);
        })(),
    );
});

function generateUUID() {
    if (crypto.randomUUID != undefined) {
        return crypto.randomUUID();
    }
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

readCallback = {}
async function readFromIndexedDB(clientId, table, key) {
    const client = await self.clients.get(clientId);
    const queryId = generateUUID();
    return new Promise((res, rej) => {
        readCallback[queryId] = async (data) => {
            try {
                res(data)
            } catch {
                rej()
            }
        }
        client.postMessage({
            source: "VideoTogether",
            type: 2011,
            data: {
                id: queryId,
                table: table,
                key: key
            }
        })
    })
}
async function fetchIndexedDbVideos(clientId, url) {
    const arr = url.split('/fetch-indexeddb-videos/')
    const key = arr[arr.length - 1]
    const record = await readFromIndexedDB(clientId, 'videos', key);
    const originalResponse = await fetch(record.data);

    const newResponse = new Response(originalResponse.body, {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: originalResponse.headers
    });

    return newResponse;
}

async function fetchIndexedDbFuture(clientId, url) {
    const arr = url.split('/fetch-indexeddb-future/')
    const key = arr[arr.length - 1]
    const record = await readFromIndexedDB(clientId, 'future', key);
    return fetch(record.data);
}


console.log("service worker")
self.addEventListener('fetch', (event) => {
    const clientId = event.clientId;

    if (!event.request.url.startsWith('http')) {
        return;
    }

    if (event.request.url.includes("/fetch-current-m3u8-content")) {
        const response = new Response(m3u8Cache[clientId], {
            headers: { 'Content-Type': 'application/vnd.apple.mpegurl' }
        });
        event.respondWith(response);
        return;
    }

    if (event.request.url.includes('/fetch-indexeddb-videos/')) {
        event.respondWith(fetchIndexedDbVideos(clientId, event.request.url));
        return;
    }

    if (event.request.url.includes('/fetch-indexeddb-future/')) {
        event.respondWith(fetchIndexedDbFuture(clientId, event.request.url));
        return;
    }

    event.respondWith(
        (async () => {
            const r = await caches.match(event.request);
            console.log(`[Service Worker] Fetching resource: ${event.request.url}`);
            if (r) {
                return r;
            }
            const response = await fetch(event.request);
            const cache = await caches.open(cacheName);
            console.log(`[Service Worker] Caching new resource: ${event.request.url}`);
            cache.put(event.request, response.clone());
            return response;
        })(),
    );
});

m3u8Cache = {}

self.addEventListener("message", (e) => {
    if (e.data.source == "VideoTogether") {
        switch (e.data.type) {
            case 2012: {
                readCallback[e.data.data.id](e.data.data.data)
                readCallback[e.data.data.id] = undefined;
                break;
            }
            case 2013: {
                m3u8Cache[e.source.id] = e.data.data;
                break;
            }
        }
    }
})