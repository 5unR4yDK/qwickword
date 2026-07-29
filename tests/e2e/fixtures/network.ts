import {
  test as base,
  expect,
  type CDPSession,
  type Page,
} from "@playwright/test";

type ConnectionType = "none" | "cellular3g";

export type NetworkProfile = {
  offline: boolean;
  latency: number;
  downloadThroughput: number;
  uploadThroughput: number;
  connectionType: ConnectionType;
  packetLoss?: number;
};

const KIB = 1024;

/**
 * Named, reviewable network conditions rather than ad-hoc sleeps in tests.
 *
 * Throughput values are bytes/second, matching Chromium's DevTools protocol.
 * The mobile profile is intentionally poor but usable: enough latency to
 * expose duplicate-submit and loading-state bugs without making CI flaky.
 */
export const NETWORK_PROFILES = {
  healthy: {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: "none",
  },
  slowMobile: {
    offline: false,
    latency: 650,
    downloadThroughput: 48 * KIB,
    uploadThroughput: 16 * KIB,
    connectionType: "cellular3g",
    packetLoss: 0,
  },
  offline: {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: "none",
  },
} satisfies Record<string, NetworkProfile>;

export class NetworkHarness {
  private readonly session: CDPSession;

  private constructor(session: CDPSession) {
    this.session = session;
  }

  static async attach(page: Page): Promise<NetworkHarness> {
    const session = await page.context().newCDPSession(page);
    await session.send("Network.enable");
    return new NetworkHarness(session);
  }

  /**
   * Applies the same condition to requests and `navigator.onLine`.
   *
   * Chromium split those responsibilities into two commands: request
   * throttling by rule, and navigator state. Keeping them together prevents a
   * test from saying "offline" while app code still sees `navigator.onLine`.
   */
  async use(profile: NetworkProfile): Promise<void> {
    const conditions = {
      urlPattern: "",
      latency: profile.latency,
      downloadThroughput: profile.downloadThroughput,
      uploadThroughput: profile.uploadThroughput,
      connectionType: profile.connectionType,
      packetLoss: profile.packetLoss,
      offline: profile.offline,
    };

    await this.session.send("Network.emulateNetworkConditionsByRule", {
      matchedNetworkConditions: [conditions],
    });
    await this.session.send("Network.overrideNetworkState", {
      offline: profile.offline,
      latency: profile.latency,
      downloadThroughput: profile.downloadThroughput,
      uploadThroughput: profile.uploadThroughput,
      connectionType: profile.connectionType,
    });
  }

  async reset(): Promise<void> {
    await this.use(NETWORK_PROFILES.healthy);
  }

  async detach(): Promise<void> {
    await this.session.detach();
  }
}

export const test = base.extend<{ network: NetworkHarness }>({
  network: async ({ page }, provide) => {
    const network = await NetworkHarness.attach(page);
    try {
      await provide(network);
    } finally {
      await network.reset();
      await network.detach();
    }
  },
});

export { expect };
