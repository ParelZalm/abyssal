/** Shared lifecycle for DOM UI pieces — root element in, mount/destroy out. */
export interface Component {
  readonly element: HTMLElement;
  mount(parent: HTMLElement): void;
  destroy(): void;
}
