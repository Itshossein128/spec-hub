/**
 * BookStack REST client for the Next.js portal (server-only).
 * Mirrors apps/mcp-server/src/bookstack/client.ts env contract.
 */

export type BookStackConfig = {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
};

export type BookStackTag = { name: string; value?: string; order?: number };

export type BookStackBook = {
  id: number;
  name: string;
  slug: string;
};

export type BookStackShelf = {
  id: number;
  name: string;
  slug: string;
  books?: BookStackBook[];
};

export type BookStackChapter = {
  id: number;
  name: string;
  slug: string;
  book_id: number;
};

export type BookStackPage = {
  id: number;
  name: string;
  slug: string;
  book_id: number;
  chapter_id?: number;
  markdown?: string;
};

export type BookStackPageSummary = {
  id: number;
  name: string;
  slug: string;
  book_id: number;
  chapter_id: number;
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

export function hasBookStackConfig(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const baseUrl = env.BOOKSTACK_URL || env.BOOKSTACK_APP_URL;
  return Boolean(baseUrl && env.BOOKSTACK_TOKEN_ID && env.BOOKSTACK_TOKEN_SECRET);
}

export function loadBookStackConfig(
  env: NodeJS.ProcessEnv = process.env,
): BookStackConfig {
  const baseUrl = (env.BOOKSTACK_URL || env.BOOKSTACK_APP_URL || "").replace(
    /\/$/,
    "",
  );
  const tokenId = env.BOOKSTACK_TOKEN_ID ?? "";
  const tokenSecret = env.BOOKSTACK_TOKEN_SECRET ?? "";
  if (!baseUrl || !tokenId || !tokenSecret) {
    throw new Error(
      "BookStack API config missing. Set BOOKSTACK_URL, BOOKSTACK_TOKEN_ID, and BOOKSTACK_TOKEN_SECRET.",
    );
  }
  return { baseUrl, tokenId, tokenSecret };
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
      cache: "no-store",
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

  async listShelves(count = 100): Promise<BookStackListResponse<BookStackShelf>> {
    return this.request("GET", `/shelves?count=${count}`);
  }

  async getShelf(id: number): Promise<BookStackShelf> {
    return this.request("GET", `/shelves/${id}`);
  }

  async createShelf(input: {
    name: string;
    description?: string;
    books?: number[];
  }): Promise<BookStackShelf> {
    return this.request("POST", "/shelves", input);
  }

  async updateShelf(
    id: number,
    input: { name?: string; books?: number[] },
  ): Promise<BookStackShelf> {
    return this.request("PUT", `/shelves/${id}`, input);
  }

  async listBooks(count = 100): Promise<BookStackListResponse<BookStackBook>> {
    return this.request("GET", `/books?count=${count}`);
  }

  async getBook(id: number): Promise<BookStackBook & { contents?: Array<{ type: string; id: number; name: string }> }> {
    return this.request("GET", `/books/${id}`);
  }

  async createBook(input: {
    name: string;
    description?: string;
  }): Promise<BookStackBook> {
    return this.request("POST", "/books", input);
  }

  async listChapters(
    bookId?: number,
    count = 100,
  ): Promise<BookStackListResponse<BookStackChapter>> {
    const filter = bookId != null ? `&filter[book_id]=${bookId}` : "";
    return this.request("GET", `/chapters?count=${count}${filter}`);
  }

  async createChapter(input: {
    book_id: number;
    name: string;
    description?: string;
  }): Promise<BookStackChapter> {
    return this.request("POST", "/chapters", input);
  }

  async listPages(options?: {
    bookId?: number;
    chapterId?: number;
    count?: number;
  }): Promise<BookStackListResponse<BookStackPageSummary>> {
    const count = options?.count ?? 100;
    const parts = [`count=${count}`];
    if (options?.bookId != null) parts.push(`filter[book_id]=${options.bookId}`);
    if (options?.chapterId != null) {
      parts.push(`filter[chapter_id]=${options.chapterId}`);
    }
    return this.request("GET", `/pages?${parts.join("&")}`);
  }

  async getPage(id: number): Promise<BookStackPage> {
    return this.request("GET", `/pages/${id}`);
  }

  async createPage(input: {
    book_id: number;
    chapter_id?: number;
    name: string;
    markdown: string;
    tags?: BookStackTag[];
  }): Promise<BookStackPage> {
    return this.request("POST", "/pages", input);
  }

  async updatePage(
    id: number,
    input: {
      name?: string;
      markdown?: string;
      tags?: BookStackTag[];
    },
  ): Promise<BookStackPage> {
    return this.request("PUT", `/pages/${id}`, input);
  }

  pageUrl(page: BookStackPage): string {
    return `${this.config.baseUrl}/books/${page.book_id}/page/${page.slug}`;
  }

  /** BookStack universal entity link (works for pages/chapters/books). */
  entityLink(id: number): string {
    return `${this.config.baseUrl}/link/${id}`;
  }
}

export function createBookStackClient(
  env: NodeJS.ProcessEnv = process.env,
): BookStackClient {
  return new BookStackClient(loadBookStackConfig(env));
}
