<script setup>
import { onMounted, ref, watch } from "vue";
import { fetch } from "@tauri-apps/plugin-http";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "../stores/settings-store.js";
import {
    cfListNamespaces,
    cfListKeys,
    cfReadKeyValuePair,
} from "../api/cloudflare.js";

const settingsStore = useSettingsStore();
const {
    isValidApiKey,
    cfAccountId,
    cfApiKey,
    cfNamespaceId,
    cfKeyValuePairs,
    cfNamespaceKeys,
    cfKeysCursor,
} = storeToRefs(settingsStore);

const baseUrl = "https://api.cloudflare.com/client/v4";

const urlListNamespaceKeys =
    baseUrl +
    `/accounts/${cfAccountId.value}/storage/kv/namespaces/${cfNamespaceId.value}/keys`;
const urlReadKeyValuePair =
    baseUrl +
    `/accounts/${cfAccountId.value}/storage/kv/namespaces/${cfNamespaceId.value}/values/`;

//const url = baseUrl + `/accounts/${cfAccountId.value}/storage/kv/namespaces/${NAMESPACE_ID}/values/${key_name}`;
const options = {
    method: "GET",
    headers: {
        Authorization: `Bearer ${cfApiKey.value}`,
        "Content-Type": "application/json",
    },
};

// Lists namespace keys
const listKeys = async (limit = 1000, cursor) => {
    let url = urlListNamespaceKeys + `?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Fetch keys error! status: ${response.status}`);
    }
    const data = await response.json();
    return { keys: data.result, info: data.result_info };
};

// Fetch all key-value pairs from stored cursor
const listAllKeys = async () => {
    let allKeys = [];
    let limit = 1000;
    let cursor = cfKeysCursor.value || null;
    let fetchMore = true;
    let apiCallCount = 0;

    try {
        while (fetchMore) {
            const { keys, info } = await listKeys(limit, cursor);

            apiCallCount++;
            allKeys = allKeys.concat(keys);
            cursor = info.cursor;

            console.log(
                `API calls: ${apiCallCount}. Fetched ${keys.length} keys. Total keys fetched: ${allKeys.length}`,
            );

            // Save cursor so we don't fetch all keys again
            if (cursor) cfKeysCursor.value = cursor;
            if (!cursor || info.count < limit) fetchMore = false;
        }
    } catch (error) {
        console.error("Error fetching keys:", error);
    }

    return { keys: allKeys, apiCalls: apiCallCount, cursor: cursor };
};

const loading = ref(false);

const refreshKeyValuePairs = async () => {
    try {
        let apiCallCount = 0;
        let kvPairs = [];
        let lastKeys = [];

        loading.value = true;

        // Get all keys
        const { keys, apiCalls } = await listAllKeys();
        apiCallCount += apiCalls;

        // Filter out new keys
        const newKeys = keys.filter(
            (key) =>
                !cfNamespaceKeys.value.some((item) => item.name === key.name),
        );

        console.log(`Fetched ${keys.length} keys. New keys: ${newKeys.length}`);

        // Store new keys in local storage
        cfNamespaceKeys.value = [...cfNamespaceKeys.value, ...newKeys];

        // Get values for the 100 most recent keys
        const kvCount = 100;
        lastKeys = keys.slice(-kvCount);

        // Fetch values for the new keys
        const promises = lastKeys.map(async (key) => {
            const response = await fetch(
                urlReadKeyValuePair + key.name,
                options,
            );
            if (!response.ok) {
                throw new Error(
                    `Fetch key:value error! status: ${JSON.stringify(response)}`,
                );
            }
            const data = await response.json();
            apiCallCount++;

            kvPairs.push({ key: key.name, ...data });
        });

        // Wait for all of the above promises to resolve, and then store the new key-value pairs.
        // We do not want to include it in the loop above for performance reasons.
        await Promise.all(promises);
        cfKeyValuePairs.value = [...kvPairs];
    } catch (error) {
        console.error("Error fetching data:", error);
    } finally {
        loading.value = false;
    }
};

// { key, timestamp, type, text, data }
const kvHeaders = ref([
    { title: "Timestamp", key: "timestamp", width: "180px" },
    { title: "Type", key: "type" },
    { title: "Text", key: "text", width: "210px" },
    { title: "Data", key: "data" },
]);

const search = ref("");

const loadingNamespaces = ref(false);
const namespaceOptions = ref([]);

const loadNamespaceOptions = async () => {
    if (isValidApiKey.value == false) return;

    loadingNamespaces.value = true;
    let result = await cfListNamespaces(cfApiKey.value, cfAccountId.value);

    namespaceOptions.value = result.map((item) => ({
        title: item.title,
        value: item.id,
    }));
    loadingNamespaces.value = false;
};

const kvImportProgress = ref(0);
const kvImportStatus = ref("");
const kvImportMessage = ref("");
const kvImportError = ref(null);

const fetchAllKeyValuePairs = async () => {
    kvImportError.value = null;
    kvImportMessage.value = "Starting fetch...";

    const limit = 1000;
    const apiCallLimit = 1000;
    let cursor = null;
    let allKeyValuePairs = [];
    let totalFetched = 0;
    let allKeys = [];
    let apiCallCount = 0;

    // Function to wait for a specified time
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    kvImportStatus.value = "fetching";
    kvImportMessage.value = `Fetching all key-value pairs...`;

    try {
        const { keys, apiCalls } = await listAllKeys();
        apiCallCount += apiCalls;

        // Filter out new keys
        const newKeys = keys.filter(
            (key) =>
                !cfNamespaceKeys.value.some((item) => item.name === key.name),
        );

        console.log(`Fetched ${keys.length} keys. New keys: ${newKeys.length}`);

        // Store new keys in local storage
        cfNamespaceKeys.value = [...cfNamespaceKeys.value, ...newKeys];

        // Check if need to wait
        if (apiCallCount >= apiCallLimit) {
            kvImportStatus.value = "waiting";
            kvImportMessage.value =
                "API call limit reached. Waiting for 5 minutes before continuing.";

            await wait(5 * 60 * 1000);
            apiCallCount = 0;
        }

        let batchSize = Math.min(
            apiCallLimit - apiCallCount,
            keys.length - allKeyValuePairs.length,
        );
        console.log(`Set batch size to ${batchSize}`);

        // Fetch values for each key in batches
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize);

            kvImportStatus.value = "fetching";
            kvImportMessage.value = `Fetching values for keys ${i + 1} to ${i + batch.length}`;

            const fetchPromises = batch.map(async (key) => {
                apiCallCount++;
                const value = await cfReadKeyValuePair(
                    cfApiKey.value,
                    cfAccountId.value,
                    cfNamespaceId.value,
                    key.name,
                );
                return { key: key.name, ...value };
            });

            const keyValuePairs = await Promise.all(fetchPromises);
            allKeyValuePairs = allKeyValuePairs.concat(keyValuePairs);

            cfKeyValuePairs.value = cfKeyValuePairs.value.concat(keyValuePairs);

            totalFetched += allKeyValuePairs.length;

            kvImportStatus.value = "progress";
            kvImportProgress.value = Math.round(
                (totalFetched / keys.length) * 100,
            );

            if (apiCallCount >= apiCallLimit) {
                kvImportStatus.value = "waiting";
                kvImportMessage.value =
                    "API call limit reached. Waiting for 5 minutes before continuing.";

                console.log(
                    "API call limit reached. Waiting for 5 minutes before continuing.",
                );
                await wait(5 * 60 * 1000);
                apiCallCount = 0;
            }
        }
        kvImportStatus.value = "completed";
    } catch (error) {
        console.error("Error fetching data:", error);
    }
    // keyValuePairs.value = allKeyValuePairs;
};

onMounted(async () => await loadNamespaceOptions());
watch(isValidApiKey, async () => await loadNamespaceOptions());
watch(cfNamespaceId, async () => await refreshKeyValuePairs());
</script>

<template>
    <v-card flat width="100%">
        <v-card-title class="d-flex flex-wrap">
            <v-select
                class="flex-1-0 ma-2"
                v-model="cfNamespaceId"
                :items="namespaceOptions"
                label="Select namespace"
                prepend-inner-icon="mdi-database"
                append-icon="mdi-cloud-sync"
                variant="outlined"
                density="compact"
                @click:append="refreshKeyValuePairs()"
                :disabled="isValidApiKey == false"
                :loading="loadingNamespaces"
            >
            </v-select>

            <v-text-field
                class="ma-2"
                v-model="search"
                label="Search"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                single-line
                density="compact"
            >
            </v-text-field>

            <v-progress-linear
                v-model="kvImportProgress"
                color="amber"
                height="25"
            >
                <template v-slot:default="{ value }">
                    <div class="text-subtitle-1 text-center">
                        {{ Math.ceil(value) }}%
                    </div>
                </template>
            </v-progress-linear>
            <div>
                {{ kvImportError }}
                {{ kvImportMessage }}
            </div>
        </v-card-title>

        <v-divider />

        <v-data-table
            width="100%"
            :headers="kvHeaders"
            :items="cfKeyValuePairs"
            item-value="key"
            :loading="loading"
            density="compact"
            fixed-header
            height="90vh"
            :search="search"
            hide-default-footer
            items-per-page="-1"
        >
            <template v-slot:no-data>
                <v-btn
                    color="orange-darken-2"
                    prepend-icon="mdi-cloud-sync"
                    text="Fetch KV pairs"
                    :disabled="isValidApiKey == false"
                    @click="fetchAllKeyValuePairs()"
                />
            </template>
        </v-data-table>
    </v-card>
</template>
