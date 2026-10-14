import { EligibilityMetrics, EligibilityPriority } from '../types';

export class MetricsCollector {
  private totalEvaluated: number = 0;
  private evaluationLatencies: number[] = [];
  private waitTimesHigh: number[] = [];
  private waitTimesNormal: number[] = [];
  private startTime: number = Date.now();
  private starvationCount: number = 0;
  private starvationThresholdMs: number = 5000;
  private deadlockCyclesDetected: number = 0;

  public recordEvaluation(
    latencyMs: number,
    queueWaitMs: number,
    priority: EligibilityPriority
  ): void {
    this.totalEvaluated++;
    this.evaluationLatencies.push(latencyMs);
    if (this.evaluationLatencies.length > 5000) {
      this.evaluationLatencies.shift();
    }

    if (priority === 'HIGH') {
      this.waitTimesHigh.push(queueWaitMs);
      if (this.waitTimesHigh.length > 2000) this.waitTimesHigh.shift();
    } else {
      this.waitTimesNormal.push(queueWaitMs);
      if (this.waitTimesNormal.length > 2000) this.waitTimesNormal.shift();
      if (queueWaitMs > this.starvationThresholdMs) {
        this.starvationCount++;
      }
    }
  }

  public recordDeadlock(): void {
    this.deadlockCyclesDetected++;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[Math.max(0, index)] * 100) / 100;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  private calculateMax(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(Math.max(...values) * 100) / 100;
  }

  public getMetrics(activeQueueDepth: number = 0): EligibilityMetrics {
    const elapsedSeconds = Math.max(1, (Date.now() - this.startTime) / 1000);
    const throughput = Math.round((this.totalEvaluated / elapsedSeconds) * 100) / 100;

    return {
      total_evaluated: this.totalEvaluated,
      p95_evaluation_ms: this.calculatePercentile(this.evaluationLatencies, 95),
      active_queue_depth: activeQueueDepth,
      throughput_per_sec: throughput,
      wait_times_by_priority: {
        HIGH: {
          avg_wait_ms: this.calculateAverage(this.waitTimesHigh),
          p95_wait_ms: this.calculatePercentile(this.waitTimesHigh, 95),
          max_wait_ms: this.calculateMax(this.waitTimesHigh)
        },
        NORMAL: {
          avg_wait_ms: this.calculateAverage(this.waitTimesNormal),
          p95_wait_ms: this.calculatePercentile(this.waitTimesNormal, 95),
          max_wait_ms: this.calculateMax(this.waitTimesNormal)
        }
      },
      starvation_count: this.starvationCount,
      deadlock_cycles_detected: this.deadlockCyclesDetected
    };
  }

  public reset(): void {
    this.totalEvaluated = 0;
    this.evaluationLatencies = [];
    this.waitTimesHigh = [];
    this.waitTimesNormal = [];
    this.startTime = Date.now();
    this.starvationCount = 0;
    this.deadlockCyclesDetected = 0;
  }
}

export const globalMetricsCollector = new MetricsCollector();
