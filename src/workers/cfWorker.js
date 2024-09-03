// import { cfListKeys, cfReadKeyValuePair } from "../api/cloudflare.js";
importScripts("../api/cloudflare.js");
self.onmessage = async function (e) {
    const { apiKey, accountId, namespaceId } = e.data;

    console.log("[woker] - fetching key-value pairs");
    self.postMessage({
        status: "error",
        message: `Fetching started`,
    });

    return;

    let limit = 1000;
    let cursor = null;
    let allKeyValuePairs = [];
    let totalFetched = 0;
    let allKeys = [];
    let apiCallCount = 0;

    const apiCallLimit = 1200;
    // Function to wait for a specified time
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    while (true) {
        self.postMessage({
            status: "fetching",
            message: `Fetching batch starting with cursor: ${cursor}`,
        });

        const { keys, info } = await cfListKeys(
            apiKey,
            accountId,
            namespaceId,
            limit,
            cursor,
        );

        apiCallCount++;

        allKeys = allKeys.concat(keys);

        if (!info.cursor) {
            break;
        }

        cursor = info.cursor;

        if (apiCallCount >= apiCallLimit) {
            self.postMessage({
                status: "waiting",
                message:
                    "API call limit reached. Waiting for 5 minutes before continuing.",
            });
            await wait(5 * 60 * 1000);
            apiCallCount = 0;
        }
    }

    // Fetch values for each key in batches
    for (let i = 0; i < allKeys.length; i += 100) {
        const batch = allKeys.slice(i, i + 100);

        self.postMessage({
            status: "fetching",
            message: `Fetching values for keys ${i + 1} to ${i + batch.length}`,
        });

        const fetchPromises = batch.map(async (key) => {
            apiCallCount++;
            const value = await cfReadKeyValuePair(
                apiKey,
                accountId,
                namespaceId,
                key,
            );
            return { key: key.name, value };
        });

        const keyValuePairs = await Promise.all(fetchPromises);
        allKeyValuePairs = allKeyValuePairs.concat(keyValuePairs);
        totalFetched += keyValuePairs.length;

        self.postMessage({
            status: "progress",
            totalFetched,
            totalKeys: allKeys.length,
        });

        if (apiCallCount >= apiCallLimit) {
            self.postMessage({
                status: "waiting",
                message:
                    "API call limit reached. Waiting for 5 minutes before continuing.",
            });
            await wait(5 * 60 * 1000);
            apiCallCount = 0;
        }
    }

    self.postMessage({ status: "completed", allKeyValuePairs });
};
