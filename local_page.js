function GetDownloadStatusStr(status) {
    switch (status) {
        case 0:
            return "下载未完成"
        case 1:
            return "下载完成"
        case 2:
            return "删除失败,请重试"
        default:
            return "异常"
    }
}

function extractM3u8IdFromKey(key) {
    try {
        const arr = key.split('#m3u8Id-')
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
            line = "/fetch-indexeddb-videos/" + line + `#m3u8Id-${m3u8Id}`
            return line
        }
    });

    // Join the modified lines back into a single string
    const modifiedText = modifiedLines.join('\n');

    return modifiedText;
}
