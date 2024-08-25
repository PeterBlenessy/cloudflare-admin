import { createApp } from "vue";
import App from "./App.vue";

// Pinia stuff
import { createPinia } from 'pinia';

// Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

// import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'; // Ensure you are using css-loader

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
    components,
    directives,
    icons: {
        defaultSet: 'mdi',

    },
    theme: {
        defaultTheme: 'dark'
    },
});
app.use(vuetify);

// ---------------------------------------------------------------------------------------------
// Mount the app
app.mount("#app");
