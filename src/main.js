import { createApp } from "vue";
import App from "./App.vue";

// Pinia stuff
import { createPinia } from 'pinia';

// Vuetify
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { md2 } from 'vuetify/blueprints';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

// ---------------------------------------------------------------------------------------------
// Create the app
const app = createApp(App);

// ---------------------------------------------------------------------------------------------
// Make pinia available in the app
const pinia = createPinia();
app.use(pinia);

// ---------------------------------------------------------------------------------------------
// Make Vuetify available in the app
const vuetify = createVuetify({
    blueprint: md2,
    components,
    directives,
    icons: {
        defaultSet: 'mdi',
        aliases,
        sets: {
            mdi,
        },
    },
    theme: {
        defaultTheme: 'dark'
    },
});
app.use(vuetify);

// ---------------------------------------------------------------------------------------------
// Mount the app
app.mount("#app");
