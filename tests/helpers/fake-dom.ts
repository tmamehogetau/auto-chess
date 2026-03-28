export class FakeClassList {
  private readonly owner: FakeElement;

  public constructor(owner: FakeElement) {
    this.owner = owner;
  }

  public add(...tokens: string[]): void {
    for (const token of tokens) {
      if (token.length === 0) {
        continue;
      }

      const current = this.owner.className.split(" ").filter((entry) => entry.length > 0);
      if (!current.includes(token)) {
        current.push(token);
      }
      this.owner.className = current.join(" ");
    }
  }

  public remove(...tokens: string[]): void {
    const current = this.owner.className.split(" ").filter((entry) => entry.length > 0);
    this.owner.className = current.filter((entry) => !tokens.includes(entry)).join(" ");
  }

  public toggle(token: string, force?: boolean): boolean {
    const current = this.owner.className.split(" ").filter((entry) => entry.length > 0);
    const has = current.includes(token);
    const shouldHave = force ?? !has;

    if (shouldHave && !has) {
      current.push(token);
    }

    this.owner.className = shouldHave
      ? current.join(" ")
      : current.filter((entry) => entry !== token).join(" ");

    return shouldHave;
  }
}

export class FakeElement {
  public className = "";
  public dataset: Record<string, string> = {};
  public style: Record<string, string> = {};
  public textContent = "";
  public tabIndex = -1;
  public draggable = false;
  public title = "";
  public role = "";
  public ariaLabel = "";
  public onclick: (() => void) | null = null;
  public onpointerdown: (() => void) | null = null;
  public ondragstart: ((event: unknown) => void) | null = null;
  public ondragend: (() => void) | null = null;
  public ondragover: ((event: unknown) => void) | null = null;
  public ondragleave: (() => void) | null = null;
  public ondrop: ((event: unknown) => void) | null = null;
  public onkeydown: ((event: { key: string; preventDefault: () => void }) => void) | null = null;
  public classList: FakeClassList;
  public children: FakeElement[] = [];
  public attributes: Record<string, string> = {};
  public clickCount = 0;
  private innerHtmlValue = "";

  public constructor() {
    this.classList = new FakeClassList(this);
  }

  public get innerHTML(): string {
    return this.innerHtmlValue;
  }

  public set innerHTML(value: string) {
    this.innerHtmlValue = value;
    if (value === "") {
      this.children = [];
    }
  }

  public append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  public appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  public setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    if (name === "aria-label") {
      this.ariaLabel = value;
    }
    if (name === "role") {
      this.role = value;
    }
  }

  public getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  public click(): void {
    this.clickCount += 1;
    this.onclick?.();
  }
}

export function findDescendantByClass(root: FakeElement | undefined, className: string): FakeElement | null {
  if (!root) {
    return null;
  }

  const classes = root.className.split(" ").filter((entry) => entry.length > 0);
  if (classes.includes(className)) {
    return root;
  }

  for (const child of root.children) {
    const found = findDescendantByClass(child, className);
    if (found) {
      return found;
    }
  }

  return null;
}

export function createFakeDocument(): Document {
  return {
    createElement: () => new FakeElement(),
  } as unknown as Document;
}
