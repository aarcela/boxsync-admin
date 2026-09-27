import * as Sentry from '@sentry/nextjs';
import { getSentryInitOptions } from './lib/sentry-scrub';

Sentry.init(getSentryInitOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
