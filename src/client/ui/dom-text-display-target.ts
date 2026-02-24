import type { TextDisplayTarget } from "./round-state-display-controller";

interface TextContentElement {
  textContent: string | null;
}

interface QueryRoot {
  querySelector(selector: string): unknown;
}

export class DomTextDisplayTarget implements TextDisplayTarget {
  public constructor(private readonly element: TextContentElement) {}

  public setText(value: string): void {
    this.element.textContent = value;
  }
}

export function createDomTextDisplayTarget(
  root: QueryRoot,
  selector: string,
): DomTextDisplayTarget | null {
  const element = root.querySelector(selector);

  if (!isTextContentElement(element)) {
    return null;
  }

  return new DomTextDisplayTarget(element);
}

function isTextContentElement(value: unknown): value is TextContentElement {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "textContent" in value;
}
