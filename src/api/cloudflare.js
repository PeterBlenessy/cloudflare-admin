import { fetch } from "@tauri-apps/plugin-http";

const baseUrl = "https://api.cloudflare.com/client/v4";

//const url = baseUrl + `/accounts/${cfAccountId.value}/storage/kv/namespaces/${NAMESPACE_ID}/values/${key_name}`;

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
const cfVerifyApiKey = async (apiKey) => {
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
const cfListNamespaces = async (apiKey, accountId) => {
    const urlListNamespaces =
        baseUrl + `/accounts/${accountId}/storage/kv/namespaces`;

    const response = await fetch(urlListNamespaces, getOptions(apiKey));
    if (!response.ok) {
        throw new Error(`Fetch namespaces error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.result;
};

// Lists namespace keys
const cfListKeys = async (
    apiKey,
    accountId,
    namespaceId,
    limit = 1000,
    cursor,
) => {
    const urlListNamespaceKeys =
        baseUrl +
        `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`;

    let url = urlListNamespaceKeys + `?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = await fetch(url, getOptions(apiKey));
    if (!response.ok) {
        throw new Error(`Fetch keys error! status: ${response.status}`);
    }
    const data = await response.json();
    return { keys: data.result, info: data.result_info };
};

// Read key-value pair
const cfReadKeyValuePair = async (apiKey, accountId, namespaceId, key) => {
    const urlReadKeyValuePair =
        baseUrl +
        `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/`;

    const response = await fetch(urlReadKeyValuePair + key, getOptions(apiKey));
    if (!response.ok) {
        throw new Error(
            `Fetch key-value pair error! status: ${response.status}`,
        );
    }
    return await response.json();
};

export { cfVerifyApiKey, cfListNamespaces, cfListKeys, cfReadKeyValuePair };
