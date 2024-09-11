<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "../stores/settings-store.js";
import cfClient from "../api/cloudflare.js";
import localforage from "localforage";

const settingsStore = useSettingsStore();
const {
    isValidApiKey,
    cfAccountId,
    cfApiKey,
    cfNamespaceId,
    cfNamespaceKeys,
    cfKeysCursor,
    keyQueue,
    itemsToProcess,
    itemsProcessed,
    importMessage,
} = storeToRefs(settingsStore);

// Model used to pick up button click from parent
const clearDB = defineModel({ default: false });

// Reactive array connected to the KV table
const keyValuePairs = ref([]);

//--------------------------------------------------------------------------------
// Local KV Storage

const loadingFromDB = ref(false);
watch(clearDB, () => clearKeyValuePairs());

// Initialize localforage instance (IndexedDB)
const kvDB = localforage.createInstance({
    name: "cf-admin",
    storeName: "kv-pairs",
});

// Store key-value pairs in IndexedDB
const storeKeyValuePair = (key, value) => {
    keyValuePairs.value.push({ key: key.name, ...value });
    kvDB.setItem(key, value)
        .then(() => {})
        .catch((error) => console.error("[kvStore.setItem]", error));
};

// Clear all key-value pairs stored in IndexedDB
const clearKeyValuePairs = () => {
    stopKeyQueueProcessing();
    keyQueue.value = [];
    keyValuePairs.value = [];
    itemsProcessed.value = 0;
    itemsToProcess.value = 0;

    kvDB.clear()
        .then(() => {
            keyValuePairs.value = [];
            clearDB.value = false;
        })
        .catch((error) => console.error("[kvStore.clear]", error));
};

// Load key-value pairs from IndexedDB
const loadKeyValuePairs = () => {
    console.time("loadKeyValuePairs()");
    loadingFromDB.value = true;
    let data = [];
    kvDB.iterate((value, key, iterationNumber) => {
        data.push(value);
    })
        .then(() => {
            keyValuePairs.value = data;
            console.log("[loadingFromDB] - done");
        })
        .catch((error) => {
            throw new Error(error);
        })
        .finally(() => {
            loadingFromDB.value = false;
            console.timeEnd("loadKeyValuePairs()");
        });
};

//--------------------------------------------------------------------------------
// Cloudflare API calls
const cf = cfClient(cfApiKey.value, cfAccountId.value);

// Fetch all keys from stored cursor
const fetchAllKeys = async () => {
    let allKeys = [];
    let limit = 1000;
    let cursor = cfKeysCursor.value || null;
    let fetchMore = true;

    try {
        while (fetchMore) {
            const { keys, info } = await cf.listKeys(
                cfNamespaceId.value,
                limit,
                cursor,
            );

            allKeys = allKeys.concat(keys);
            cursor = info.cursor;

            console.log(
                `[fetchAllKeys] - Fetched ${keys.length} keys. Total: ${allKeys.length}`,
            );
            // Save cursor so we don't fetch all keys again next time
            if (cursor) cfKeysCursor.value = cursor;
            if (!cursor || info.count < limit) fetchMore = false;
        }
    } catch (error) {
        console.error("[fetchAllKeys] - Error fetching keys:", error);
    }
    return { keys: allKeys, cursor: cursor };
};

const fetchKeyValue = async (key) => {
    try {
        const value = await cf.readKeyValuePair(cfNamespaceId.value, key.name);
        storeKeyValuePair(key.name, value);
        itemsProcessed.value++;
    } catch (error) {
        console.error(
            `[fetchKeyValue] - Error fetching value for key ${key.name} at position ${itemsProcessed.value}`,
            error,
        );
        console.error(
            `[fetchKeyValue] - Fetched ${itemsProcessed.value} (${itemsToProcess.value}) keys`,
        );
    }
};

//--------------------------------------------------------------------------------
// Queue Processing

let keyQueueTimer;

// 1200 requests per 5 minutes => max 4 api calls per second => 250ms delay
const rateInterval = 300;

const loadingFromWeb = ref(false);
const importProgress = computed(() =>
    itemsToProcess.value == 0
        ? 0
        : (itemsProcessed.value / itemsToProcess.value) * 100,
);

// Processes 'limit' keys from the key-queue, default is one key
const processKeyQueue = async (batchSize = 1) => {
    if (keyQueue.value.length > 0) {
        if (batchSize > 1) {
            console.log(`[process] - Processing a batch of ${batchSize} keys`);

            // Remove the last batchSize elements from the end of the queue
            const batch = keyQueue.value.splice(-batchSize);
            // Map the batch to fetchFunction calls
            const promises = batch.map((param) => fetchKeyValue(param));

            try {
                // Wait for all promises in the current batch to resolve
                await Promise.all(promises);
                console.log(`[process] - Batch of ${batchSize} completed`);
            } catch (error) {
                console.error("[process] - Error in batch processing", error);
            }
        } else {
            // Process the last element in the array, which is the latest log
            const key = keyQueue.value.pop();
            await fetchKeyValue(key);
        }
    } else {
        console.log("[process] - Key-queue is empty");
        stopKeyQueueProcessing();
    }
};

const startKeyQueueProcessing = async () => {
    console.log("[start] - Queue processing started");
    console.log(`[start] - Queue length:, ${keyQueue.value.length}`);
    loadingFromWeb.value = true;

    // If queue is empty, fetch new keys
    if (keyQueue.value.length == 0) {
        console.log("[start] - Queue empty. Fetching (new) keys");

        importMessage.value = "Fetching keys... ";
        const { keys } = await fetchAllKeys();

        // Filter out new keys
        const newKeys = keys.filter(
            (key) =>
                !cfNamespaceKeys.value.some((item) => item.name === key.name),
        );

        console.log(
            `[start] - Fetched ${keys.length} keys. New keys: ${newKeys.length}`,
        );

        if (newKeys.length == 0) {
            console.log("[start] - No new keys to process. Exiting.");
            importMessage.value = "No new logs to fetch. ";
            return;
        }

        // Initiate key queue
        keyQueue.value = [...newKeys];
        itemsToProcess.value = keyQueue.value.length;

        // Store new keys
        cfNamespaceKeys.value = cfNamespaceKeys.value.concat(newKeys);

        // Process a batch of max 100 keys from queue, to update table quickly.
        // The rest will be scheduled to avoid the rateLimit.
        const batchSize = Math.min(100, keyQueue.value.length);
        console.log(`[start] - Processing first ${batchSize} keys`);
        importMessage.value = `Fetching most recent ${batchSize} logs...`;
        await processKeyQueue(batchSize);
    }

    console.log("[start] - Processing keys");
    console.log(`[start] - Processing ${keyQueue.value.length} keys`);
    importMessage.value = "Fetching logs...";
    keyQueueTimer = setInterval(processKeyQueue, rateInterval);
};

const stopKeyQueueProcessing = () => {
    console.log("[stop] - Key-queue processing stopped");
    console.log(`[stop] - Keys left in queue: ${keyQueue.value.length}`);

    clearInterval(keyQueueTimer);
    loadingFromWeb.value = false;

    if (
        itemsProcessed.value < itemsToProcess.value &&
        itemsToProcess.value > 0
    ) {
        importMessage.value = "Fetching paused";
    } else {
        importMessage.value = "Fetching completed";
        // Hide the message and progress bar 15 seconds
        setTimeout(() => {
            console.log("[stop] - Closing progress bar");
            itemsToProcess.value = 0;
            itemsProcessed.value = 0;
            keyQueue.value = [];
        }, 60000);
    }
};

// Start or stop key-queue processing
const handleKeyQueueProcessing = () => {
    if (loadingFromWeb.value == true) {
        stopKeyQueueProcessing();
    } else {
        startKeyQueueProcessing();
    }
};

// { key, timestamp, type, text, data }
const kvHeaders = ref([
    { title: "Timestamp", key: "timestamp", width: "180px" },
    { title: "Type", key: "type" },
    { title: "Text", key: "text", width: "210px" },
    { title: "Data", key: "data" },
]);
const sortBy = ref([{ key: "timestamp", order: "desc" }]);

const search = ref("");
const page = ref(1);
const itemsPerPage = ref(25);
const pageCount = computed(() => {
    return Math.ceil(keyValuePairs.value.length / itemsPerPage.value);
});
const loadingNamespaces = ref(false);
const namespaceOptions = ref([]);

const loadNamespaceOptions = async () => {
    if (isValidApiKey.value == false) return;

    loadingNamespaces.value = true;
    let result = await cf.listNamespaces();

    namespaceOptions.value = result.map((item) => ({
        title: item.title,
        value: item.id,
    }));
    loadingNamespaces.value = false;
};

onMounted(async () => await loadNamespaceOptions());
onMounted(async () => loadKeyValuePairs());
onMounted(() => {
    if (
        itemsToProcess.value > 0 &&
        itemsToProcess.value > itemsProcessed.value
    ) {
        importMessage.value = "Fetching paused";
    }
});

watch(isValidApiKey, async () => await loadNamespaceOptions());
watch(cfNamespaceId, async () => handleKeyQueueProcessing());

onUnmounted(() => clearInterval(keyQueueTimer));
onUnmounted(() => stopKeyQueueProcessing());
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
                variant="outlined"
                density="compact"
                :disabled="isValidApiKey == false"
                :loading="loadingNamespaces"
            >
            </v-select>

            <v-btn
                :icon="
                    loadingFromWeb ? 'mdi-cloud-cancel' : 'mdi-cloud-refresh'
                "
                variant="plain"
                class="ma-1"
                :color="loadingFromWeb ? 'orange darken-2' : ''"
                @click="handleKeyQueueProcessing()"
            />
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
        </v-card-title>

        <v-divider />

        <v-data-table
            width="100%"
            :headers="kvHeaders"
            :sort-by="sortBy"
            :items="keyValuePairs"
            :loading="loadingFromDB"
            :search="search"
            item-value="key"
            density="compact"
            fixed-header
            fixed-footer
            height="calc(100vh - 195px)"
            :items-per-page="itemsPerPage"
            v-model:page="page"
        >
            <template v-slot:no-data>
                <v-btn
                    color="orange-darken-2"
                    prepend-icon="mdi-cloud-sync"
                    text="Fetch KV pairs"
                    :disabled="isValidApiKey == false"
                    @click.stop="handleKeyQueueProcessing()"
                />
            </template>

            <template v-slot:bottom>
                <v-row
                    class="d-flex flex-row bg-surface-variant wrap"
                    dense
                    no-gutters
                    v-show="loadingFromWeb || itemsToProcess > 0"
                >
                    <v-col class="justify-start ma-2 text-truncate" cols="2">
                        {{ importMessage }}
                    </v-col>

                    <v-col
                        class="me-auto ma-2"
                        cols="3"
                        style="min-width: 100px; max-width: 300px"
                    >
                        <v-progress-linear
                            v-model="importProgress"
                            :indeterminate="itemsProcessed == 0"
                            :striped="itemsProcessed == 0"
                            color="orange-darken-2"
                            height="20"
                            rounded="sm"
                            class="mb-1"
                        >
                            <template v-slot:default="{ value }">
                                <div
                                    class="text-caption text-center"
                                    v-if="itemsProcessed != 0"
                                >
                                    {{ itemsProcessed }} ({{ itemsToProcess }})
                                </div>
                            </template>
                        </v-progress-linear>
                    </v-col>

                    <v-col class="ma-1" cols="1">
                        <v-menu>
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    class="ma-0"
                                    color="grey-lighten-3"
                                    v-bind="props"
                                    append-icon="mdi-chevron-down"
                                    size="small"
                                    slim
                                    variant="flat"
                                >
                                    {{ itemsPerPage }}
                                </v-btn>
                            </template>
                            <v-list density="compact">
                                <v-list-item
                                    v-for="item in ['25', '50', '100', '200']"
                                    :selected="item"
                                    :key="item"
                                    :title="item"
                                    @click="itemsPerPage = parseInt(item)"
                                    class="ma-0"
                                    nav
                                    slim
                                />
                            </v-list>
                        </v-menu>
                    </v-col>

                    <v-col class="ma-1" cols="3">
                        <v-pagination
                            v-model="page"
                            :length="pageCount"
                            active-color="orange-darken-2"
                            density="compact"
                            size="small"
                            variant="text"
                        />
                    </v-col>
                </v-row>
            </template>
        </v-data-table>
    </v-card>
</template>
