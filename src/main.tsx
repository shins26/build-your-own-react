type DidactText = string | number;
type DidactChild = DidactElement | DidactText;

type DidactElement = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: any;
  props: DidactProps;
};

type DidactProps = {
  nodeValue?: DidactText;
  children: DidactElement[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

type Fiber = DidactElement & {
  dom?: HTMLElement | Text;
  parent?: Fiber;
  child?: Fiber;
  sibling?: Fiber;
  alternate?: Fiber;
  effectTag?: "UPDATE" | "PLACEMENT" | "DELETION";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hooks?: Hook<any>[];
};

function createElement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: any,
  props: DidactProps,
  ...children: DidactChild[]
): DidactElement {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  };
}

function createTextElement(text: DidactText): DidactElement {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

function createDom(fiber: Fiber): HTMLElement | Text {
  const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, { children: [] }, fiber.props);

  return dom;
}

const isEvent = (key: string) => key.startsWith("on");
const isProperty = (key: string) =>
  key !== "children" && key !== "__self" && key !== "__source" && !isEvent(key);
const isNew = (prev: DidactProps, next: DidactProps) => (key: string) =>
  prev[key] !== next[key];
const isGone = (next: DidactProps) => (key: string) => !(key in next);

function updateDom(
  dom: HTMLElement | Text,
  prevProps: DidactProps,
  nextProps: DidactProps
) {
  if (dom instanceof Text) {
    dom.nodeValue =
      typeof nextProps.nodeValue === "string" ? nextProps.nodeValue : "";
    return;
  }

  // Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // Remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(nextProps))
    .forEach((name) => {
      dom.setAttribute(name, "");
    });

  // Set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom.setAttribute(name, nextProps[name]);
    });

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

function commitRoot(): void {
  deletions.forEach(commitWork);
  commitWork(wipRoot?.child);
  currentRoot = wipRoot;
  wipRoot = undefined;
}

function commitWork(fiber?: Fiber): void {
  if (!fiber) {
    return;
  }

  let domParentFiber = fiber.parent;
  while (!domParentFiber?.dom) {
    domParentFiber = domParentFiber?.parent;
  }
  const domParent = domParentFiber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom !== undefined) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom !== undefined) {
    updateDom(
      fiber.dom,
      fiber.alternate?.props || { children: [] },
      fiber.props
    );
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber: Fiber, domParent: HTMLElement | Text) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    fiber.child && commitDeletion(fiber.child, domParent);
  }
}

function render(element: DidactElement, container: HTMLElement): void {
  wipRoot = {
    type: element.type,
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

let nextUnitOfWork: Fiber | undefined = undefined;
let currentRoot: Fiber | undefined = undefined;
let wipRoot: Fiber | undefined = undefined;
let deletions: Fiber[] = [];

function workLoop(deadline: IdleDeadline): void {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function performUnitOfWork(fiber: Fiber): Fiber | undefined {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostCompoment(fiber);
  }

  // Return next unit of work
  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber: Fiber | undefined = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}

let wipFiber: Fiber | undefined = undefined;
let hookIndex = 0;

function updateFunctionComponent(fiber: Fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}

type Hook<T> = {
  state: T;
  queue: SetState<T>[];
};

type SetState<T> = (prevState: T) => T;

function useState<T>(initial: T): [T, (action: SetState<T>) => void] {
  const oldHook =
    wipFiber?.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];
  const hook: Hook<T> = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  const actions = oldHook ? oldHook.queue : [];
  actions.forEach((action) => {
    hook.state = action(hook.state);
  });

  const setState = (action: SetState<T>) => {
    hook.queue.push(action);
    wipRoot = {
      type: "ROOT_ELEMENT",
      dom: currentRoot?.dom,
      props: currentRoot ? currentRoot.props : { children: [] },
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  wipFiber?.hooks?.push(hook);
  hookIndex++;
  return [hook.state, setState];
}

function updateHostCompoment(fiber: Fiber) {
  // Add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // Create new fibers
  reconcileChildren(fiber, fiber.props.children);
}

function reconcileChildren(wipFiber: Fiber, elements: DidactElement[]) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling: Fiber | undefined = undefined;

  while (index < elements.length || oldFiber) {
    const element = elements[index];
    let newFiber: Fiber | undefined = undefined;

    const sameType = oldFiber && element && element.type === oldFiber.type;

    if (sameType) {
      // Update the dom
      newFiber = {
        type: oldFiber?.type || "",
        props: element.props,
        dom: oldFiber?.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }
    if (element && !sameType) {
      // Add this node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: undefined,
        parent: wipFiber,
        alternate: undefined,
        effectTag: "PLACEMENT",
      };
    }
    if (oldFiber && !sameType) {
      // Delete the oldFiber's node
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (!prevSibling) {
      wipFiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
const Didact = {
  createElement,
  render,
  useState,
};

/** @jsx Didact.createElement */
// eslint-disable-next-line react-refresh/only-export-components
function Counter() {
  const [state, setState] = Didact.useState(1);
  return <h1 onClick={() => setState((c: number) => c + 1)}>Count: {state}</h1>;
}
const element = <Counter />;

const container = document.getElementById("root");
if (!container) throw new Error("No root Element");

Didact.render(element, container);
