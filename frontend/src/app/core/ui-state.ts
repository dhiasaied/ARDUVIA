import { Injectable, signal } from '@angular/core';

export type FlyoutKind = 'lessons' | 'parts' | 'settings' | 'language' | null;
export type AssistantMode = 'explain' | 'debug' | 'hint' | 'ask';

/** Cross-component UI state (panels, selection, thumbnails). */
@Injectable({ providedIn: 'root' })
export class UiState {
  readonly sidebarOpen = signal(false);
  readonly flyout = signal<FlyoutKind>(null);
  readonly selectedPart = signal<string | null>(null);
  readonly schematic = signal(false);
  readonly infoExpanded = signal(false);
  readonly codeExpanded = signal(false);
  readonly compact = signal(false);
  readonly thumbs = signal<Record<string, string>>({});
  /** Request to the stage to centre a part (set by the parts flyout). */
  readonly focusRequest = signal<{ part: string; n: number } | null>(null);
  readonly assistantOpen = signal(false);
  /** A quick action to run as soon as the assistant opens. */
  readonly assistantRequest = signal<{ mode: AssistantMode; n: number } | null>(null);
  readonly dashboardOpen = signal(false);
  /** The sketch currently in the editor (shared with the assistant). */
  readonly editorCode = signal('');
  /** Selected info-card tab (the challenge tab can be opened from elsewhere). */
  readonly infoTab = signal<'overview' | 'pinout' | 'example' | 'specs' | 'challenge'>('overview');

  openAssistant(mode?: AssistantMode): void {
    this.flyout.set(null);
    this.dashboardOpen.set(false);
    this.assistantOpen.set(true);
    if (mode) this.assistantRequest.set({ mode, n: Date.now() });
  }

  /** Request to reset the 3D view (Home). */
  readonly resetRequest = signal(0);

  toggleFlyout(kind: Exclude<FlyoutKind, null>): void {
    this.flyout.update((f) => (f === kind ? null : kind));
  }

  focusPart(part: string): void {
    this.selectedPart.set(part);
    this.focusRequest.set({ part, n: Date.now() });
  }
}
