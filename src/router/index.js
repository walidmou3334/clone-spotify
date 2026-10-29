import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import CallbackView from "../views/CallbackView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/callback",
      name: "callback",
      component: CallbackView,
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
});

export default router;