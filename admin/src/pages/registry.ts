/* Every built page, keyed by its route pattern */
import type { Page } from '../app/App';
import { configPages } from './config-pages';
import { HomeLayoutPage } from './home-layout';
import { DashboardPage } from './dashboard';
import { analyticsPages } from './analytics';
import { userPages } from './users';
import { notificationPages } from './notifications';
import { WayfindingPage } from './wayfinding';
import { adminPages } from './admin-pages';
import { ProfilePage } from './profile';
import { campaignPages, alertPages, quickLinkPages, resourcePages, segmentPages } from './collection';

export const PAGES: Record<string, Page> = {
  ...campaignPages, ...alertPages, ...quickLinkPages, ...resourcePages, ...segmentPages,
  ...configPages,
  'home-layout': HomeLayoutPage,
  dashboard: DashboardPage,
  ...analyticsPages,
  ...userPages,
  ...notificationPages,
  wayfinding: WayfindingPage,
  ...adminPages,
  profile: ProfilePage
};
