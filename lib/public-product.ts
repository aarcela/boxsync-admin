import { APP_STORE_URL, GOOGLE_PLAY_URL } from './constants/app-links';
import { PLATFORM_PLANS } from './platform-plans';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'getwodus.com';
const PAID_PLAN_IDS = ['starter', 'growth', 'pro'] as const;

/** Public marketing payload for getwodus.com (landing). Keep in sync with app/app.json. */
export function getPublicProductPayload() {
  return {
    name: 'WODUS',
    athleteApp: {
      name: 'WODUS',
      androidPackage: 'com.aaamdev.boxwave',
      iosBundle: 'com.aaamdev.wodus',
      scheme: 'boxwaveapp',
      playUrl: GOOGLE_PLAY_URL,
      appStoreUrl: APP_STORE_URL,
    },
    rootDomain: ROOT_DOMAIN,
    hqUrl: `https://hq.${ROOT_DOMAIN}`,
    staffHostPattern: `{slug}.${ROOT_DOMAIN}`,
    plans: PAID_PLAN_IDS.map((id) => ({
      id,
      priceUsd: PLATFORM_PLANS[id].priceUsd,
      maxActiveMembers: PLATFORM_PLANS[id].maxActiveMembers,
    })),
  };
}
