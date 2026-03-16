// src/lib/disciplin/events.ts

type DisciplinEventMap = {
  VISION_ANALYSIS_COMPLETED: {
    fighterId: string;
    findingIds: string[];
  };
  FUEL_LOG_CREATED: {
    fighterId: string;
    fuelLogId: string;
  };
  WEIGHT_LOG_CREATED: {
    fighterId: string;
    weightLogId: string;
  };
  CAMP_STATE_REFRESH_REQUESTED: {
    fighterId: string;
    reason: string;
  };
};

type EventName = keyof DisciplinEventMap;
type Handler<K extends EventName> = (payload: DisciplinEventMap[K]) => void | Promise<void>;

class DisciplinEventBus {
  private listeners: {
    [K in EventName]?: Handler<K>[];
  } = {};

  on<K extends EventName>(event: K, handler: Handler<K>) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as Handler<K>[]).push(handler);
  }

  async emit<K extends EventName>(event: K, payload: DisciplinEventMap[K]) {
    const handlers = (this.listeners[event] ?? []) as Handler<K>[];
    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

export const disciplinEvents = new DisciplinEventBus();