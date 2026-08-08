import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import App from './ui/App';
import { AboutDialog, ProjectsDialog, ContactDialog } from './ui/dialogs';

const rootRoute = createRootRoute({ component: App });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => null,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: AboutDialog,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsDialog,
});

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contact',
  component: ContactDialog,
});

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute, projectsRoute, contactRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
