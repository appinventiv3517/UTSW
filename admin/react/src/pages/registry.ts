/* Every built page, keyed by its route pattern */
import type { Page } from '../app/App';
import { campaignPages, alertPages, quickLinkPages, resourcePages, segmentPages } from './collection';

export const PAGES: Record<string, Page> = {
  ...campaignPages, ...alertPages, ...quickLinkPages, ...resourcePages, ...segmentPages
};
