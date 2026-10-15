import { useEffect, useRef, useState } from 'react';
import { PanResponder, type GestureResponderEvent } from 'react-native';

import type { ScreenOffset } from '@/presentation/canvas/coordinates';

const AT_REST: ScreenOffset = { dx: 0, dy: 0 };
const DRAG_THRESHOLD = 3;

type Point = { readonly x: number; readonly y: number };

function pointOf(event: GestureResponderEvent): Point {
  return { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
}

function offsetBetween(start: Point, end: Point): ScreenOffset {
  return { dx: end.x - start.x, dy: end.y - start.y };
}

export function useNodeDrag(
  enabled: boolean,
  onDrop: (offset: ScreenOffset) => Promise<void>,
) {
  const [offset, setOffset] = useState<ScreenOffset>(AT_REST);
  const latest = useRef({ enabled, onDrop });
  const touchStart = useRef<Point>({ x: 0, y: 0 });
  const dropped = useRef(false);

  useEffect(() => {
    latest.current = { enabled, onDrop };
  }, [enabled, onDrop]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (event) => {
        touchStart.current = pointOf(event);
        return false;
      },
      onMoveShouldSetPanResponder: (_event, gesture) =>
        latest.current.enabled &&
        Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
      onPanResponderMove: (event) => {
        setOffset(offsetBetween(touchStart.current, pointOf(event)));
      },
      onPanResponderRelease: (event) => {
        dropped.current = true;
        void latest.current
          .onDrop(offsetBetween(touchStart.current, pointOf(event)))
          .finally(() => setOffset(AT_REST));
      },
      onPanResponderTerminate: () => {
        setOffset(AT_REST);
      },
    }),
  ).current;

  return {
    panHandlers: responder.panHandlers,
    offset,
    dragging: offset !== AT_REST,
    resetDrop: () => {
      dropped.current = false;
    },
    wasDropped: () => dropped.current,
  };
}
