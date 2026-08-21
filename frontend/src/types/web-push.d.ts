declare module 'web-push' {
  interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
  interface SendNotificationOptions {
    TTL?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
  }
  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  function sendNotification(
    subscription: PushSubscription,
    payload: string | Buffer,
    options?: SendNotificationOptions
  ): Promise<{ statusCode: number; body?: string; headers?: Record<string, string> }>;
  function generateVAPIDKeys(): { publicKey: string; privateKey: string };
  const webpush: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
    generateVAPIDKeys: typeof generateVAPIDKeys;
  };
  export default webpush;
  export { setVapidDetails, sendNotification, generateVAPIDKeys };
}
