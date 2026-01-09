// apps/mobile/src/lib/userEvents.ts
export type FollowChangedPayload = {
    meId: string;
    targetId: string;
    status: "followed" | "unfollowed";
};

type EventMap = {
    followChanged: FollowChangedPayload;
    meUpdated: undefined;
};

type EventName = keyof EventMap;
type Handler<T> = (payload: T) => void;

const listeners: { [K in EventName]?: Set<Handler<any>> } = {};

export function on<K extends EventName>(event: K, handler: Handler<EventMap[K]>) {
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event]!.add(handler);
    return () => listeners[event]!.delete(handler);
}

export function emit<K extends EventName>(event: K, payload: EventMap[K]) {
    listeners[event]?.forEach((h) => h(payload));
}