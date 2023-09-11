
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
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
    const data = await readFromIndexedDB(clientId, 'videos', key);
    return fetch(data.dataUrl);
}


console.log("service worker")
self.addEventListener('fetch', (event) => {
    const clientId = event.clientId;


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
});

m3u8Cache = {}

self.addEventListener("message", (e) => {
    if (e.data.source == "VideoTogether") {
        switch (e.data.type) {
            case 2012: {
                readCallback[e.data.data.id](e.data.data.data)
                break;
            }
            case 2013: {
                m3u8Cache[e.source.id] = e.data.data;
                break;
            }
        }
    }
})