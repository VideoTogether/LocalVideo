window.VideoTogetherDownload = 'disabled'

function GetDownloadStatusStr(status) {
    switch (status) {
        case 0:
            return "{$DownloadStatusLabel0$}"
        case 1:
            return "{$DownloadStatusLabel1$}"
        case 2:
            return "{$DownloadStatusLabel2$}"
        default:
            return "{$DownloadStatusLabelError$}"
    }
}

function extractM3u8IdFromKey(key) {
    try {
        const arr = key.split('-m3u8Id-')[0].split('-end-')[0]
        return arr[arr.length - 1]
    } catch {
        return undefined
    }
}

function hide(e) {
    if (e) e.style.display = 'none';
}

function show(e) {
    if (e) e.style.display = null;
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/local_page_sw.js');
}

function updateM3U8KeyPaths(m3u8Content, m3u8Url, m3u8Id) {
    // Use a regular expression to find all #EXT-X-KEY, #EXT-X-MAP lines with URI="<some_url>"
    const updatedContent = m3u8Content.replace(
        /(#EXT-X-.*:[^\n]*URI=)"(.*?)"/g,
        function (match, prefix, uri) {
            // Skip data: URIs, as they don't need to be modified.
            if (uri.startsWith('data:')) {
                return match;
            }
            // Add the /rootfolder/ prefix to the URI
            const m3u8IdHead = `-m3u8Id-${m3u8Id}-end-`
            const newURI = '/fetch-indexeddb-future/' + m3u8IdHead + (new URL(uri, m3u8Url)).href

            // Replace the URI in the original line
            return `${prefix}"${new URL(newURI, window.location)}"`;
        }
    );

    return updatedContent;
}

function transferToSwM3u8(m3u8Content, m3u8Url, m3u8Id) {
    const lines = m3u8Content.split('\n');

    const modifiedLines = lines.map(line => {
        line = line.trim()
        if (line.startsWith('#')) {
            return line;
        } else {
            if (line == "") {
                return line;
            }
            console.log(line, m3u8Url, (new URL(line, m3u8Url)).href)
            line = (new URL(line, m3u8Url)).href
            const m3u8IdHead = `-m3u8Id-${m3u8Id}-end-`
            line = new URL("/fetch-indexeddb-videos/" + m3u8IdHead + line, window.location).href
            return line
        }
    });

    // Join the modified lines back into a single string
    const modifiedText = modifiedLines.join('\n');

    return updateM3U8KeyPaths(modifiedText, m3u8Url, m3u8Id);
}
