import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

// Change this to your own gateway's wakeup endpoint if it differs.
const WAKEUP_URL = 'https://management-api-gateway.onrender.com/api/wakeup';
const CALL_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const LOG_RETENTION_MS = 2 * 60 * 60 * 1000; // keep only the last 2 hours

interface WakeUpLogEntry {
  time: Date;
  ok: boolean;
  summary: string;
}

@Component({
  imports: [RouterOutlet, CommonModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('belive-project-stay');
  protected readonly logs = signal<WakeUpLogEntry[]>([]);

  private intervalId: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    // Fire one immediately on load, then keep firing every 5 minutes
    // for as long as this tab/app stays open.
    this.callWakeUp();
    this.intervalId = setInterval(() => this.callWakeUp(), CALL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private async callWakeUp(): Promise<void> {
    const now = new Date();

    try {
      const response = await fetch(WAKEUP_URL);

      let summary: string;
      if (response.ok) {
        const data = await response.json();
        summary = Object.entries(data)
          .map(([service, status]) => `${service}: ${status}`)
          .join(' · ');
      } else {
        summary = `Gateway responded with HTTP ${response.status}`;
      }

      this.addLog({ time: now, ok: response.ok, summary });
    } catch (err) {
      // A CORS block or a still-sleeping gateway both land here. The
      // request may still have reached (and woken) the server even
      // though the browser refused to let us read the response.
      this.addLog({
        time: now,
        ok: false,
        summary: `Could not read a response (${
          err instanceof Error ? err.message : 'unknown error'
        }) — service may still have been woken`,
      });
    }
  }

  private addLog(entry: WakeUpLogEntry): void {
    const cutoff = Date.now() - LOG_RETENTION_MS;
    this.logs.update((current) =>
      [entry, ...current].filter((log) => log.time.getTime() >= cutoff),
    );
  }
}
