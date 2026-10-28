import { Injectable, inject, signal } from '@angular/core';
import { MoonrakerService } from './moonraker.service';

export interface GcodeFile {
  path: string;
  modified: number;
  size: number;
}

/** G-code files, print history and per-file metadata (cached). */
@Injectable({ providedIn: 'root' })
export class FilesService {
  private readonly mr = inject(MoonrakerService);

  readonly files = signal<GcodeFile[]>([]);
  readonly history = signal<any[]>([]);
  /** Loaded metadata by file path (filled lazily by getMeta). */
  readonly metas = signal<Record<string, any>>({});
  private readonly cache = new Map<string, Promise<any>>();

  constructor() {
    this.mr.opened.subscribe(() => {
      this.loadFiles();
      this.loadHistory();
    });
    this.mr.fileListChanged.subscribe((path) => {
      if (path) this.cache.delete(path); // changed file: re-read its details
      this.loadFiles();
    });
    this.mr.historyChanged.subscribe(() => this.loadHistory());
  }

  getMeta(filename: string): Promise<any> {
    if (!this.cache.has(filename)) {
      const p = this.mr.call('server.files.metadata', { filename }).catch(() => null);
      p.then((m) => this.metas.update((all) => ({ ...all, [filename]: m })));
      this.cache.set(filename, p);
    }
    return this.cache.get(filename)!;
  }

  thumbUrl(m: any): string {
    if (!m?.thumbnails?.length) return '';
    const t = [...m.thumbnails].sort((a: any, b: any) => b.width - a.width)[0];
    const dir = m.filename.includes('/') ? m.filename.slice(0, m.filename.lastIndexOf('/') + 1) : '';
    return this.mr.api('/server/files/gcodes/' + (dir + t.relative_path).split('/').map(encodeURIComponent).join('/'));
  }

  private async loadFiles(): Promise<void> {
    try {
      const r: GcodeFile[] = await this.mr.call('server.files.list', { root: 'gcodes' });
      this.files.set(r.filter((f) => !f.path.startsWith('.')).sort((a, b) => b.modified - a.modified));
    } catch { /* not ready */ }
  }

  private async loadHistory(): Promise<void> {
    try {
      const r = await this.mr.call('server.history.list', { limit: 25, order: 'desc' });
      this.history.set(r.jobs ?? []);
    } catch { /* not ready */ }
  }
}
