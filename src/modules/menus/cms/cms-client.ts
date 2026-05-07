import * as cheerio from 'cheerio';

import { env } from '../../../config/env.js';
import { CookieJar } from '../../../lib/cookie-jar.js';
import { logger } from '../../../lib/logger.js';
import { HttpError } from '../../../lib/http-error.js';
import { CMS_URL } from './cms-selectors.js';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_FLOW_STEPS = 12;
const IDP_LOGIN_HOST = 'idp.ua.pt';

class CmsAuthenticationError extends Error {}

interface FormField {
  name: string;
  value: string;
}

interface HtmlForm {
  action: string;
  method: string;
  fields: FormField[];
}

export class CmsClient {
  private readonly cookieJar = new CookieJar();

  public async fetchHtml(): Promise<string> {
    try {
      return await this.fetchWithRetry();
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch CMS HTML');
      throw new HttpError(502, 'UPSTREAM_FETCH_FAILED', 'Failed to fetch CMS source');
    }
  }

  private async fetchWithRetry(): Promise<string> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.fetchCmsHtml();
      } catch (error) {
        lastError = error;
        this.cookieJar.clear();
        if (error instanceof CmsAuthenticationError) throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unknown CMS fetch error');
  }

  private async fetchCmsHtml(): Promise<string> {
    const initial = await this.fetchBrowserLike(CMS_URL);
    if (this.isCmsPage(initial.url)) return this.assertHtml(initial.html);

    if (!this.isIdpPage(initial.url, initial.html)) {
      throw new Error(`Unexpected CMS redirect target: ${initial.url}`);
    }

    if (!env.CMS_UA_USERNAME || !env.CMS_UA_PASSWORD) {
      throw new CmsAuthenticationError(
        'CMS now requires UA IDP login. Set CMS_UA_USERNAME and CMS_UA_PASSWORD.',
      );
    }

    await this.loginThroughIdp(initial.url, initial.html);

    const final = await this.fetchBrowserLike(CMS_URL);
    if (!this.isCmsPage(final.url)) {
      throw new Error(`Authenticated CMS fetch did not return menu page: ${final.url}`);
    }

    return this.assertHtml(final.html);
  }

  private async loginThroughIdp(startUrl: string, startHtml: string): Promise<void> {
    let currentUrl = startUrl;
    let currentHtml = startHtml;
    let submittedCredentials = false;

    for (let step = 0; step < MAX_FLOW_STEPS; step += 1) {
      const form = this.extractFirstForm(currentUrl, currentHtml);
      if (!form) {
        throw new CmsAuthenticationError('UA IDP login form was not found');
      }

      if (form.fields.some((field) => field.name === 'j_username')) {
        if (submittedCredentials) {
          throw new CmsAuthenticationError(
            'UA IDP rejected the credentials or requires an unsupported extra step',
          );
        }

        this.setFormValue(form, 'j_username', env.CMS_UA_USERNAME ?? '');
        this.setFormValue(form, 'j_password', env.CMS_UA_PASSWORD ?? '');
        this.setFormValue(form, '_eventId_proceed', '');
        submittedCredentials = true;
      } else if (
        form.fields.some((field) => field.name === 'shib_idp_ls_supported')
      ) {
        this.setFormValue(form, 'shib_idp_ls_success.shib_idp_session_ss', 'false');
        this.setFormValue(
          form,
          'shib_idp_ls_success.shib_idp_persistent_ss',
          'false',
        );
        this.setFormValue(form, 'shib_idp_ls_supported', 'false');
        this.setFormValue(form, '_eventId_proceed', '');
      } else if (!form.fields.some((field) => field.name === 'SAMLResponse')) {
        throw new CmsAuthenticationError(
          'UA IDP returned an unsupported authentication step',
        );
      }

      const submitted = await this.submitForm(form);
      currentUrl = submitted.url;
      currentHtml = submitted.html;

      if (this.isCmsPage(currentUrl) || new URL(currentUrl).hostname === 'cms.ua.pt') {
        return;
      }
    }

    throw new Error('UA IDP login flow exceeded maximum steps');
  }

  private async submitForm(form: HtmlForm): Promise<{ url: string; html: string }> {
    const method = form.method.toUpperCase();
    const params = new URLSearchParams();
    for (const field of form.fields) {
      params.append(field.name, field.value);
    }

    if (method === 'GET') {
      const url = new URL(form.action);
      for (const [key, value] of params) url.searchParams.append(key, value);
      return this.fetchBrowserLike(url.toString());
    }

    return this.fetchBrowserLike(form.action, {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: new URL(form.action).origin,
        Referer: form.action,
      },
    });
  }

  private async fetchBrowserLike(
    url: string,
    init: RequestInit = {},
  ): Promise<{ url: string; html: string }> {
    let currentUrl = url;
    let currentInit = init;

    for (let step = 0; step < MAX_FLOW_STEPS; step += 1) {
      const response = await this.fetchOnce(currentUrl, currentInit);
      this.cookieJar.store(response.url, response.headers);

      if (this.isRedirect(response)) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`Redirect without Location from ${response.url}`);

        currentUrl = new URL(location, response.url).toString();
        currentInit = {
          method: 'GET',
          headers: this.copySafeHeaders(init.headers),
        };
        continue;
      }

      if (!response.ok) {
        throw new Error(`Unexpected CMS/IDP status: ${response.status}`);
      }

      const html = await response.text();
      const samlForm = this.extractSamlResponseForm(response.url, html);
      if (samlForm) {
        return this.submitForm(samlForm);
      }

      return {
        url: response.url,
        html,
      };
    }

    throw new Error('CMS/IDP flow exceeded maximum redirects');
  }

  private async fetchOnce(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers = new Headers(init.headers);
      const cookieHeader = this.cookieJar.headerFor(url);
      if (cookieHeader) headers.set('Cookie', cookieHeader);

      return await fetch(url, {
        ...init,
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractFirstForm(baseUrl: string, html: string): HtmlForm | null {
    const $ = cheerio.load(html);
    const form = $('form').first();
    if (form.length === 0) return null;

    const rawAction = form.attr('action') ?? baseUrl;
    return {
      action: new URL(rawAction, baseUrl).toString(),
      method: form.attr('method') ?? 'GET',
      fields: form
        .find('input')
        .toArray()
        .map((element) => {
          const input = $(element);
          const name = input.attr('name');
          if (!name) return null;

          const type = input.attr('type')?.toLowerCase();
          if ((type === 'checkbox' || type === 'radio') && !input.attr('checked')) {
            return null;
          }

          return {
            name,
            value: input.attr('value') ?? '',
          };
        })
        .filter((field): field is FormField => field !== null),
    };
  }

  private extractSamlResponseForm(baseUrl: string, html: string): HtmlForm | null {
    const $ = cheerio.load(html);
    const samlInput = $('input[name="SAMLResponse"]').first();
    if (samlInput.length === 0) return null;

    const formElement = samlInput.closest('form');
    if (formElement.length === 0) return null;

    return this.extractFirstForm(baseUrl, $.html(formElement));
  }

  private setFormValue(form: HtmlForm, name: string, value: string): void {
    const field = form.fields.find((candidate) => candidate.name === name);
    if (field) {
      field.value = value;
      return;
    }

    form.fields.push({ name, value });
  }

  private isRedirect(response: Response): boolean {
    return response.status >= 300 && response.status < 400;
  }

  private isCmsPage(url: string): boolean {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'cms.ua.pt' && parsedUrl.pathname === '/ementas/ementas';
  }

  private isIdpPage(url: string, html: string): boolean {
    return new URL(url).hostname === IDP_LOGIN_HOST || html.includes('j_username');
  }

  private assertHtml(html: string): string {
    if (!html.trim()) {
      throw new Error('CMS response body is empty');
    }

    return html;
  }

  private copySafeHeaders(headers: RequestInit['headers']): Headers {
    const nextHeaders = new Headers(headers);
    nextHeaders.delete('Content-Type');
    nextHeaders.delete('Origin');
    nextHeaders.delete('Referer');
    return nextHeaders;
  }
}
