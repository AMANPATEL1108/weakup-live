import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

const WAKEUP_URL = 'https://management-api-gateway.onrender.com/api/wakeup';
const CALL_INTERVAL_MS = 30 * 1000; // every 30 seconds
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
      this.addLog({
        time: now,
        ok: false,
        summary: `Could not reach gateway (${
          err instanceof Error ? err.message : 'unknown error'
        }) - it may still have woken up from this request`,
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
