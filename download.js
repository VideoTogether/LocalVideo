//*/
(async function () {

    function extractExtXKeyUrls(m3u8Content, baseUrl) {
        const uris = [];
        const lines = m3u8Content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('#EXT-X-KEY')) {
                const match = line.match(/URI="(.*?)"/);

                if (match && match[1]) {
                    let uri = match[1];

                    // Ignore data: URIs as they don't need to be downloaded
                    if (uri.startsWith('data:')) {
                        continue;
                    }

                    // If the URI is not absolute, make it so by combining with the base URL.
                    if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
                        uri = new URL(uri, baseUrl).href;
                    }

                    uris.push(uri);
                }
            }
        }

        return uris;
    }

    async function timeoutAsyncRead(reader, timeout) {
        const timer = new Promise((_, rej) => {
            const id = setTimeout(() => {
                reader.cancel();
                rej(new Error('Stream read timed out'));
            }, timeout);
        });

        return Promise.race([
            reader.read(),
            timer
        ]);
    }

    function generateUUID() {
        if (crypto.randomUUID != undefined) {
            return crypto.randomUUID();
        }
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    window.updateM3u8Status = async function updateM3u8Status(m3u8Url, status) {
        // 0 downloading  1 completed 2 deleting
        let m3u8mini = await readFromIndexedDB('m3u8s-mini', m3u8Url);
        m3u8mini.status = status
        await saveToIndexedDB('m3u8s-mini', m3u8Url, m3u8mini);
    }

    async function saveM3u8(m3u8Url, m3u8Content) {
        await saveToIndexedDB('m3u8s', m3u8Url,
            {
                data: m3u8Content,
                title: vtArgTitle,
                pageUrl: vtArgPageUrl,
                m3u8Url: m3u8Url,
                m3u8Id: m3u8Id,
                status: 0
            }
        )

    }

    async function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (event) {
                resolve(event.target.result);
            };
            reader.onerror = function (event) {
                reject(new Error("Failed to read blob"));
            };
            reader.readAsDataURL(blob);
        });
    }

    async function saveBlob(table, url, blob) {
        return new Promise(async (res, rej) => {
            try {
                const dataUrl = await blobToDataUrl(blob);
                await saveToIndexedDB(table, url, {
                    data: dataUrl,
                    m3u8Url: downloadM3u8Url,
                    m3u8Id: m3u8Id,
                })
                res();
            } catch {
                rej();
            }
        })
    }

    window.regexMatchKeys = function regexMatchKeys(table, regex) {
        const queryId = generateUUID()
        return new Promise((res, rej) => {
            window.postMessage({
                source: "VideoTogether",
                type: 2005,
                data: {
                    table: table,
                    regex: regex,
                    id: queryId
                }
            }, '*')
            regexCallback[queryId] = (data) => {
                try {
                    res(data)
                } catch { rej() }
            }
        })
    }

    window.saveToIndexedDB = async function saveToIndexedDB(table, key, data) {
        const queryId = generateUUID();
        return new Promise((res, rej) => {
            data.saveTime = Date.now()
            window.postMessage({
                source: "VideoTogether",
                type: 2001,
                data: {
                    table: table,
                    key: key,
                    data: data,
                    id: queryId,
                }
            }, '*')
            data = null;
            saveCallback[queryId] = (error) => {
                if (error === 0) {
                    res(0)
                } else {
                    rej()
                }
            }
        })
    }

    let readCallback = {}
    let regexCallback = {}
    let deleteCallback = {}
    let saveCallback = {}

    window.addEventListener('message', async e => {
        if (e.data.source == "VideoTogether") {
            switch (e.data.type) {
                case 2003: {
                    saveCallback[e.data.data.id](e.data.data.error)
                    saveCallback[e.data.data.id] = undefined
                    break;
                }
                case 2004: {
                    readCallback[e.data.data.id](e.data.data.data)
                    readCallback[e.data.data.id] = undefined;
                    break;
                }
                case 2006: {
                    regexCallback[e.data.data.id](e.data.data.data)
                    regexCallback[e.data.data.id] = undefined;
                    break;
                }
                case 2008: {
                    deleteCallback[e.data.data.id](e.data.data.error);
                    deleteCallback[e.data.data.id] = undefined;
                    break;
                }
                case 2010: {
                    console.log(e.data.data.data);
                    break;
                }
            }
        }
    })
    window.requestStorageEstimate = function requestStorageEstimate() {
        window.postMessage({
            source: "VideoTogether",
            type: 2009,
            data: {}
        }, '*')
    }
    window.deleteFromIndexedDB = function deleteFromIndexedDB(table, key) {
        const queryId = generateUUID()
        window.postMessage({
            source: "VideoTogether",
            type: 2007,
            data: {
                id: queryId,
                table: table,
                key: key,
            }
        }, '*')
        return new Promise((res, rej) => {
            deleteCallback[queryId] = (error) => {
                if (error === 0) {
                    res(true);
                } else {
                    rej();
                }
            }
        })
    }

    window.readFromIndexedDB = function readFromIndexedDB(table, key) {
        const queryId = generateUUID();

        window.postMessage({
            source: "VideoTogether",
            type: 2002,
            data: {
                table: table,
                key: key,
                id: queryId,
            }
        }, '*')
        return new Promise((res, rej) => {
            readCallback[queryId] = (data) => {
                try {
                    res(data);
                } catch {
                    rej()
                }
            }
        })
    }

    if (window.videoTogetherExtension === undefined) {
        return;
    }
    if (window.location.hostname == 'local.2gether.video') {
        return;
    }
    let vtArgM3u8Url = undefined;
    let vtArgM3u8Content = undefined;
    let vtArgM3u8Urls = undefined;
    let vtArgTitle = undefined;
    let vtArgPageUrl = undefined;
    try {
        vtArgM3u8Url = _vtArgM3u8Url;
        vtArgM3u8Content = _vtArgM3u8Content;
        vtArgM3u8Urls = _vtArgM3u8Urls;
        vtArgTitle = _vtArgTitle;
        vtArgPageUrl = _vtArgPageUrl;
    } catch {
        return;
    }

    const m3u8Id = generateUUID()
    const downloadM3u8Url = vtArgM3u8Url;
    const numThreads = 10;
    let lastTotalBytes = 0;
    let totalBytes = 0;
    let failedUrls = []
    let urls = vtArgM3u8Urls
    let successCount = 0;
    videoTogetherExtension.downloadPercentage = 0;

    const m3u8Key = downloadM3u8Url + `#m3u8Id-${m3u8Id}`
    if (downloadM3u8Url === undefined) {
        return;
    }

    await saveM3u8(downloadM3u8Url + `#m3u8Id-${m3u8Id}`, vtArgM3u8Content)

    const otherUrl = extractExtXKeyUrls(vtArgM3u8Content, downloadM3u8Url);
    const totalCount = urls.length + otherUrl.length;

    console.log(otherUrl);

    await downloadInParallel('future', otherUrl, numThreads);

    setInterval(function () {
        videoTogetherExtension.downloadSpeedMb = (totalBytes - lastTotalBytes) / 1024 / 1024;
        lastTotalBytes = totalBytes;
    }, 1000);

    await downloadInParallel('videos', urls, numThreads);
    await updateM3u8Status(m3u8Key, 1)
    async function fetchWithSpeedTracking(url) {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            controller.abort();
        }, 20000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer)
        if (!response.body) {
            throw new Error("ReadableStream not yet supported in this browser.");
        }

        const contentType = response.headers.get("Content-Type") || "application/octet-stream";

        const reader = response.body.getReader();
        let chunks = [];

        async function readStream() {
            const { done, value } = await timeoutAsyncRead(reader, 60000);
            if (done) {
                return;
            }

            if (value) {
                chunks.push(value);
                totalBytes += value.length;
            }

            // Continue reading the stream
            return await readStream();
        }
        await readStream();
        const blob = new Blob(chunks, { type: contentType });
        chunks = null;
        return blob;
    }

    async function downloadWorker(table, urls, index, step, total) {
        if (index >= total) {
            return;
        }

        const url = urls[index];
        try {
            let blob = await fetchWithSpeedTracking(url);
            await saveBlob(table, url + `#m3u8Id-${m3u8Id}`, blob);
            blob = null;
            successCount++;
            videoTogetherExtension.downloadPercentage = Math.floor((successCount / totalCount) * 100)
            console.log('download ts:', table, index, 'of', total);
        } catch (e) {
            await new Promise(r => setTimeout(r, 2000));
            failedUrls.push(url);
            console.error(e);
        }

        // Pick up the next work item
        await downloadWorker(table, urls, index + step, step, total);
    }

    async function downloadInParallel(table, urls, numThreads) {
        const total = urls.length;

        // Start numThreads download workers
        const promises = Array.from({ length: numThreads }, (_, i) => {
            return downloadWorker(table, urls, i, numThreads, total);
        });

        await Promise.all(promises);
        if (failedUrls.length != 0) {
            urls = failedUrls;
            failedUrls = [];
            await downloadInParallel(table, urls, numThreads);
        }
    }
})()
//