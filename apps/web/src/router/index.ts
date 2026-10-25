/** App routes: experiments, new run, definitions, experiment, run, run compare. */
import { createRouter, createWebHistory } from 'vue-router';
import DefinitionsPage from '../features/definitions/DefinitionsPage.vue';
import ExperimentDetailPage from '../features/experiment-detail/ExperimentDetailPage.vue';
import ExperimentsPage from '../features/experiments/ExperimentsPage.vue';
import NewRunPage from '../features/new-run/NewRunPage.vue';
import RunComparePage from '../features/run-compare/RunComparePage.vue';
import RunInspectorPage from '../features/run-inspector/RunInspectorPage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'experiments', component: ExperimentsPage, meta: { title: 'Overview' } },
    { path: '/new', name: 'new-run', component: NewRunPage, meta: { title: 'New run' } },
    { path: '/definitions', name: 'definitions', component: DefinitionsPage, meta: { title: 'Tasks & configs' } },
    { path: '/experiments/:id', name: 'experiment', component: ExperimentDetailPage, props: true, meta: { title: 'Experiment' } },
    { path: '/experiments/:id/runs/:runId', name: 'run', component: RunInspectorPage, props: true, meta: { title: 'Run' } },
    {
      path: '/experiments/:id/compare/:left/:right',
      name: 'run-compare',
      component: RunComparePage,
      props: true,
      meta: { title: 'Compare runs' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

// Per-page title, and move focus to the content after navigation (WCAG 2.4.2, 2.4.3).
router.afterEach((to, from) => {
  document.title = `${(to.meta.title as string | undefined) ?? 'Agent Eval Lab'} · Agent Eval Lab`;
  if (from.matched.length) requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
});
