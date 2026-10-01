/** Tracks local work that arrives during a sync without treating repeated wake-up events as work. */
export class SyncWorkTracker {
  private generation = 0;
  private runGeneration = 0;

  markLocalWork() {
    this.generation++;
  }

  beginRun() {
    this.runGeneration = this.generation;
  }

  needsFollowUp(success: boolean, forcePending: boolean, targetChanged: boolean) {
    return targetChanged || (success && (forcePending || this.generation > this.runGeneration));
  }
}
