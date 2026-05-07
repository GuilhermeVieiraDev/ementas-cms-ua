interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

export class CookieJar {
  private readonly cookies = new Map<string, Cookie>();

  public clear(): void {
    this.cookies.clear();
  }

  public store(responseUrl: string, headers: Headers): void {
    const setCookies = this.getSetCookieHeaders(headers);
    const url = new URL(responseUrl);

    for (const setCookie of setCookies) {
      const [pair, ...attributes] = setCookie.split(';').map((part) => part.trim());
      if (!pair) continue;

      const separator = pair.indexOf('=');
      if (separator === -1) continue;

      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      let domain = url.hostname;
      let path = '/';

      for (const attribute of attributes) {
        const [rawKey, rawValue] = attribute.split('=');
        const key = rawKey?.toLowerCase();
        if (key === 'domain' && rawValue) domain = rawValue.replace(/^\./, '');
        if (key === 'path' && rawValue) path = rawValue;
      }

      this.cookies.set(`${domain}|${path}|${name}`, {
        name,
        value,
        domain,
        path,
      });
    }
  }

  public headerFor(requestUrl: string): string | null {
    const url = new URL(requestUrl);
    const matchingCookies = Array.from(this.cookies.values()).filter((cookie) => {
      const domainMatches =
        url.hostname === cookie.domain || url.hostname.endsWith(`.${cookie.domain}`);
      return domainMatches && url.pathname.startsWith(cookie.path);
    });

    if (matchingCookies.length === 0) return null;

    return matchingCookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  private getSetCookieHeaders(headers: Headers): string[] {
    const headersWithCookies = headers as Headers & {
      getSetCookie?: () => string[];
    };

    return headersWithCookies.getSetCookie?.() ?? [];
  }
}
