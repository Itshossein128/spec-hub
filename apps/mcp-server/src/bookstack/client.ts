/**
 * BookStack REST API client (token auth).
 * Env: BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, BOOKSTACK_TOKEN_SECRET
 */

export type BookStackConfig = {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
};

export type BookStackTag = { name: string; value?: string; order?: number };

export type BookStackPageSummary = {
  id: number;
  name: string;
  slug: string;
  book_id: number;
  chapter_id: number;
  draft: boolean;
  template: boolean;
  created_at: string;
  updated_at: string;
  tags?: BookStackTag[];
};

export type BookStackPage = BookStackPageSummary & {
  html?: string;
  markdown?: string;
  raw_html?: string;
  book_slug?: string;
};

export type BookStackBook = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type BookStackShelf = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  books?: BookStackBook[];
  created_at: string;
  updated_at: string;
};

export type BookStackListResponse<T> = {
  data: T[];
  total: number;
};

export class BookStackApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "BookStackApiError";
  }
}

export function loadBookStackConfig(
  env: NodeJS.ProcessEnv = process.env,
): BookStackConfig {
  const baseUrl = (
    env.BOOKSTACK_URL ||
    env.BOOKSTACK_APP_URL ||
    ""
  ).replace(/\/$/, "");
  const tokenId = env.BOOKSTACK_TOKEN_ID ?? "";
  const tokenSecret = env.BOOKSTACK_TOKEN_SECRET ?? "";

  if (!baseUrl || !tokenId || !tokenSecret) {
    throw new Error(
      "BookStack API config missing. Set BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET.",
    );
  }

  return { baseUrl, tokenId, tokenSecret };
}

export function hasBookStackConfig(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const baseUrl = env.BOOKSTACK_URL || env.BOOKSTACK_APP_URL;
  return Boolean(baseUrl && env.BOOKSTACK_TOKEN_ID && env.BOOKSTACK_TOKEN_SECRET);
}

export class BookStackClient {
  constructor(private readonly config: BookStackConfig) {}

  private authHeader(): string {
    return `Token ${this.config.tokenId}:${this.config.tokenSecret}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BookStackApiError(
        `BookStack ${method} ${path} failed: ${res.status}`,
        res.status,
        text,
      );
    }

    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  async listShelves(count = 100, offset = 0): Promise<BookStackListResponse<BookStackShelf>> {
    return this.request(
      "GET",
      `/shelves?count=${count}&offset=${offset}`,
    );
  }

  async getShelf(id: number): Promise<BookStackShelf> {
    return this.request("GET", `/shelves/${id}`);
  }

  async listBooks(count = 100, offset = 0): Promise<BookStackListResponse<BookStackBook>> {
    return this.request("GET", `/books?count=${count}&offset=${offset}`);
  }

  async getBook(id: number): Promise<BookStackBook> {
    return this.request("GET", `/books/${id}`);
  }

  async listPages(
    countOrOptions:
      | number
      | {
          bookId?: number;
          chapterId?: number;
          count?: number;
          offset?: number;
        } = 100,
    offset = 0,
  ): Promise<BookStackListResponse<BookStackPageSummary>> {
    const options =
      typeof countOrOptions === "number"
        ? { count: countOrOptions, offset }
        : countOrOptions;
    const count = options.count ?? 100;
    const off = options.offset ?? 0;
    const parts = [`count=${count}`, `offset=${off}`];
    if (options.bookId != null) {
      parts.push(`filter[book_id]=${options.bookId}`);
    }
    if (options.chapterId != null) {
      parts.push(`filter[chapter_id]=${options.chapterId}`);
    }
    return this.request("GET", `/pages?${parts.join("&")}`);
  }

  async getPage(id: number): Promise<BookStackPage> {
    return this.request("GET", `/pages/${id}`);
  }

  /** BookStack universal entity link (pages/chapters/books). */
  entityLink(id: number): string {
    return `${this.config.baseUrl}/link/${id}`;
  }

  async search(
    query: string,
    count = 20,
  ): Promise<BookStackListResponse<{ type: string; id: number; name: string; url: string }>> {
    const q = encodeURIComponent(query);
    return this.request("GET", `/search?query=${q}&count=${count}`);
  }

  async createPage(input: {
    book_id: number;
    chapter_id?: number;
    name: string;
    markdown?: string;
    html?: string;
    tags?: BookStackTag[];
  }): Promise<BookStackPage> {
    return this.request("POST", "/pages", input);
  }

  async updatePage(
    id: number,
    input: {
      name?: string;
      markdown?: string;
      html?: string;
      tags?: BookStackTag[];
      book_id?: number;
      chapter_id?: number;
    },
  ): Promise<BookStackPage> {
    return this.request("PUT", `/pages/${id}`, input);
  }
}

export function createBookStackClient(
  env: NodeJS.ProcessEnv = process.env,
): BookStackClient {
  return new BookStackClient(loadBookStackConfig(env));
}
