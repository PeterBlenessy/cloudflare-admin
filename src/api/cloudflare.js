import { fetch } from "@tauri-apps/plugin-http";

const baseUrl = "https://api.cloudflare.com/client/v4";
//const url = baseUrl + `/accounts/${cfAccountId.value}/storage/kv/namespaces/${NAMESPACE_ID}/values/${key_name}`;

const cfClient = (apiKey, accountId) => {
    // Get options for fetch
    const getOptions = (apiKey) => {
        return {
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
        };
    };

    // Verify API key
    const verifyApiKey = async () => {
        const urlVerifyApiKey = baseUrl + "/user/tokens/verify";

        const response = await fetch(urlVerifyApiKey, getOptions(apiKey));
        if (response.ok) {
            const data = await response.json();
            return data.result.status === "active";
        } else {
            return false;
        }
    };

    // List namespaces
    const listNamespaces = async () => {
        const urlListNamespaces =
            baseUrl + `/accounts/${accountId}/storage/kv/namespaces`;

        const response = await fetch(urlListNamespaces, getOptions(apiKey));
        if (!response.ok) {
            throw new Error(
                `Fetch namespaces error! Response: ${JSON.stringify(response)}`,
            );
        }
        const data = await response.json();
        return data.result;
    };

    // Lists keys in a namespace with pagination, starting from cursor
    const listKeys = async (namespaceId, limit = 1000, cursor) => {
        const urlListNamespaceKeys =
            baseUrl +
            `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`;

        let url = urlListNamespaceKeys + `?limit=${limit}`;
        if (cursor) url += `&cursor=${cursor}`;

        const response = await fetch(url, getOptions(apiKey));
        if (!response.ok) {
            throw new Error(
                `Fetch keys error! Response: ${JSON.stringify(response)}`,
            );
        }
        const data = await response.json();
        return { keys: data.result, info: data.result_info };
    };

    // Read key-value pair
    const readKeyValuePair = async (namespaceId, key) => {
        const urlReadKeyValuePair =
            baseUrl +
            `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/`;

        const response = await fetch(
            urlReadKeyValuePair + key,
            getOptions(apiKey),
        );
        if (!response.ok) {
            throw new Error(
                `Fetch key-value pair error! Response: ${JSON.stringify(response)}`,
            );
        }
        return await response.json();
    };

    return {
        verifyApiKey,
        listNamespaces,
        listKeys,
        readKeyValuePair,
    };
};

export default cfClient;
