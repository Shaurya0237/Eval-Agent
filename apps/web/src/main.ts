/** App entry: Vue + router + TanStack Query (server state). */
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './styles/main.css';

createApp(App).use(router).use(VueQueryPlugin).mount('#app');
