import {
  Component,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {isPlatformServer} from '@angular/common';

@Component({
  selector: 'prompt-badge-list',
  templateUrl: './prompt-badge-list.html',
  styles: `
    .prompt-names {
      margin-top: 0.4rem;
      display: flex;
      width: 100%;
    }

    .status-badge {
      font-size: 0.75rem;
      font-weight: 400;
    }

    .toggle-badge {
      cursor: pointer;
      font-weight: 500;

      &:hover {
        opacity: 0.8;
      }
    }
  `,
})
export class PromptBadgeList {
  readonly promptNames = input.required<string[]>();

  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly injector = inject(Injector);
  private lastContainerWidth = 0;
  private pendingMeasure = false;
  private containerRef = viewChild.required<ElementRef<HTMLElement>>('container');

  protected measuring = signal(true);
  protected expanded = signal(false);
  protected visibleCount = signal<number>(Infinity);

  protected visibleNames = computed(() => {
    const names = this.promptNames();
    if (this.expanded() || this.measuring()) {
      return names;
    }
    const count = this.visibleCount();
    return isFinite(count) ? names.slice(0, count) : names;
  });

  protected hiddenCount = computed(() => {
    if (this.expanded() || this.measuring() || !isFinite(this.visibleCount())) {
      return 0;
    }
    return Math.max(0, this.promptNames().length - this.visibleCount());
  });

  protected showToggle = computed(() => {
    if (this.measuring()) {
      return false;
    }
    if (this.expanded()) {
      return isFinite(this.visibleCount());
    }
    return this.hiddenCount() > 0;
  });

  constructor() {
    effect(onCleanup => {
      if (this.isServer) {
        this.measuring.set(false);
        return;
      }
      const el = this.containerRef().nativeElement;
      const observer = new ResizeObserver(entries => {
        if (this.pendingMeasure) {
          return;
        }
        const newWidth = Math.round(entries[0].contentRect.width);
        if (newWidth !== this.lastContainerWidth) {
          this.lastContainerWidth = newWidth;
          this.scheduleMeasure();
        }
      });
      observer.observe(el);
      this.scheduleMeasure();

      onCleanup(() => observer.disconnect());
    });
  }

  protected toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.expanded.update(v => !v);
    if (!this.expanded()) {
      this.scheduleMeasure();
    }
  }

  private scheduleMeasure(): void {
    if (this.pendingMeasure) {
      return;
    }
    this.pendingMeasure = true;
    this.measuring.set(true);
    afterNextRender({read: () => this.doMeasure()}, {injector: this.injector});
  }

  private doMeasure(): void {
    this.pendingMeasure = false;

    const container = this.containerRef().nativeElement;
    const badges = Array.from(container.querySelectorAll('[data-badge]')) as HTMLElement[];

    if (badges.length === 0) {
      this.measuring.set(false);
      return;
    }

    const firstTop = badges[0].offsetTop;
    const overflowIdx = badges.findIndex(b => b.offsetTop > firstTop);

    // If overflow is detected, reserve one slot for the toggle badge
    this.visibleCount.set(overflowIdx === -1 ? Infinity : Math.max(1, overflowIdx - 1));
    this.measuring.set(false);
  }
}
