import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import App from './ui/App';

/**
 * Routes drive which in-world dialog is open — components render no DOM
 * (zero-DOM WebGL UI); App watches the pathname and tells the engine.
 */
const rootRoute = createRootRoute({ component: App });

const none = () => null;

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: none }),
  createRoute({ getParentRoute: () => rootRoute, path: '/about', component: none }),
  createRoute({ getParentRoute: () => rootRoute, path: '/projects', component: none }),
  createRoute({ getParentRoute: () => rootRoute, path: '/contact', component: none }),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
