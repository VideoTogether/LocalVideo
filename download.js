//*/
(async function () {

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
        let m3u8 = await readFromIndexedDB('m3u8s', m3u8Url);
        m3u8.status = status
        await saveToIndexedDB('m3u8s-mini', m3u8Url, m3u8mini);
        await saveToIndexedDB('m3u8s', m3u8Url, m3u8)
    }

    async function saveM3u8(m3u8Url, m3u8Content) {
        await saveToIndexedDB('m3u8s-mini', m3u8Url,
            {
                title: vtArgTitle,
                pageUrl: vtArgPageUrl,
                m3u8Url: m3u8Url,
                m3u8Id: m3u8Id,
                status: 0
            }
        )
        await saveToIndexedDB('m3u8s', m3u8Url,
            {
                m3u8Content: m3u8Content,
                title: vtArgTitle,
                pageUrl: vtArgPageUrl,
                m3u8Url: m3u8Url,
                m3u8Id: m3u8Id,
                status: 0
            }
        )

    }

    function blobToDataUrl(blob, callback) {
        const reader = new FileReader();
        reader.onload = function (event) {
            callback(event.target.result);
        };
        reader.readAsDataURL(blob);
    }

    async function saveVideoBlob(url, blob) {
        return new Promise((res, rej) => {
            try {
                blobToDataUrl(blob, async dataUrl => {
                    await saveToIndexedDB('videos-mini', url, {
                        m3u8Url: downloadM3u8Url,
                        m3u8Id: m3u8Id,
                    })
                    await saveToIndexedDB('videos', url, {
                        dataUrl: dataUrl,
                        m3u8Url: downloadM3u8Url,
                        m3u8Id: m3u8Id,
                    })
                    res();
                })
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
                    res(JSON.parse(data))
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
                    data: JSON.stringify(data),
                    id: queryId,
                }
            }, '*')
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
                    break;
                }
                case 2004: {
                    readCallback[e.data.data.id](e.data.data.data)
                    break;
                }
                case 2006: {
                    regexCallback[e.data.data.id](e.data.data.data)
                    break;
                }
                case 2008: {
                    deleteCallback[e.data.data.id](e.data.data.error);
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
                    res(JSON.parse(data));
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
    const m3u8Key = downloadM3u8Url + `#m3u8Id-${m3u8Id}`
    if (downloadM3u8Url === undefined) {
        return;
    }

    await saveM3u8(downloadM3u8Url + `#m3u8Id-${m3u8Id}`, vtArgM3u8Content)
    let urls = vtArgM3u8Urls
    const totalCount = urls.length;
    let successCount = 0;

    videoTogetherExtension.downloadPercentage = 0;

    let failedUrls = []

    let totalBytes = 0;
    async function fetchWithSpeedTracking(url) {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            controller.abort();
        }, 20000);

        const response = await fetch(url, { signal: controller.signal });

        if (!response.body) {
            throw new Error("ReadableStream not yet supported in this browser.");
        }

        const contentType = response.headers.get("Content-Type") || "application/octet-stream";

        const reader = response.body.getReader();
        const chunks = [];

        async function readStream() {
            const { done, value } = await timeoutAsyncRead(reader, 20000);
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
        return blob;
    }

    async function downloadWorker(urls, index, step, total) {
        if (index >= total) {
            return;
        }

        const url = urls[index];
        try {
            const blob = await fetchWithSpeedTracking(url);
            await saveVideoBlob(url + `#m3u8Id-${m3u8Id}`, blob);
            successCount++;
            videoTogetherExtension.downloadPercentage = Math.floor((successCount / totalCount) * 100)
            console.log('download ts:', index, 'of', total);
        } catch {
            failedUrls.push(url);
        }

        // Pick up the next work item
        await downloadWorker(urls, index + step, step, total);
    }

    async function downloadInParallel(urls, numThreads) {
        const total = urls.length;

        // Start numThreads download workers
        const promises = Array.from({ length: numThreads }, (_, i) => {
            return downloadWorker(urls, i, numThreads, total);
        });

        await Promise.all(promises);
        if (failedUrls.length != 0) {
            urls = failedUrls;
            failedUrls = [];
            await downloadInParallel(urls, numThreads);
        } else {
            updateM3u8Status(m3u8Key, 1)
        }
    }

    const numThreads = 10;
    downloadInParallel(urls, numThreads);
    let lastTotalBytes = 0;
    setInterval(function () {
        videoTogetherExtension.downloadSpeedMb = (totalBytes - lastTotalBytes) / 1024 / 1024;
        lastTotalBytes = totalBytes;
    }, 1000);
})()
//