import { AdMob, BannerAdOptions, BannerAdPosition, BannerAdSize, RewardAdOptions, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const isNative = () => Capacitor.isNativePlatform();

export async function initializeAdMob() {
  if (!isNative()) return;
  try {
    await AdMob.initialize({ initializeForTesting: true });
  } catch (err) {
    console.warn('AdMob init failed:', err);
  }
}

// --- Banner Ads ---

let bannerShown = false;

export async function showBanner() {
  if (!isNative() || bannerShown) return;
  try {
    const options: BannerAdOptions = {
      adId: getAdUnitId('banner'),
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: true,
    };
    await AdMob.showBanner(options);
    bannerShown = true;
  } catch (err) {
    console.warn('Banner show failed:', err);
  }
}

export async function hideBanner() {
  if (!isNative() || !bannerShown) return;
  try {
    await AdMob.hideBanner();
    bannerShown = false;
  } catch (err) {
    console.warn('Banner hide failed:', err);
  }
}

// --- Rewarded Ads ---

export async function showRewardedAd(): Promise<boolean> {
  if (!isNative()) {
    return new Promise((resolve) => setTimeout(() => resolve(true), 100));
  }

  return new Promise(async (resolve) => {
    try {
      const showListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
        if (reward.amount > 0) resolve(true);
        else resolve(false);
        showListener.remove();
        dismissListener.remove();
        failListener.remove();
      });

      const dismissListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        resolve(false);
        showListener.remove();
        dismissListener.remove();
        failListener.remove();
      });

      const failListener = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
        resolve(false);
        showListener.remove();
        dismissListener.remove();
        failListener.remove();
      });

      await AdMob.prepareRewardVideoAd({
        adId: getAdUnitId('rewarded'),
        isTesting: true,
      });
      await AdMob.showRewardVideoAd();
    } catch (err) {
      console.warn('Rewarded ad failed:', err);
      resolve(false);
    }
  });
}

// --- Helpers ---

function getAdUnitId(type: 'banner' | 'rewarded'): string {
  if (type === 'banner') {
    return 'ca-app-pub-6101922679995203/2624588478';
  }
  return 'ca-app-pub-6101922679995203/7471776386';
}
