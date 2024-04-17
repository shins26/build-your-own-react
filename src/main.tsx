type DidactText = string | number;
type DidactChild = DidactElement | DidactText;

type DidactElement = {
  type: string;
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
};

function createElement(
  type: string,
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
  if (fiber.type === "TEXT_ELEMENT") {
    return document.createTextNode(
      typeof fiber.props.nodeValue === "string" ? fiber.props.nodeValue : ""
    );
  }

  const dom = document.createElement(fiber.type);

  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      dom.setAttribute(name, fiber.props[name]);
    });

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

  // Remove old properties
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
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
  if (!fiber?.dom) {
    return;
  }
  const domParent = fiber.parent?.dom;
  if (!domParent) {
    return;
  }
  if (fiber.effectTag === "PLACEMENT" && fiber.dom !== undefined) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom !== undefined) {
    updateDom(
      fiber.dom,
      fiber.alternate?.props || { children: [] },
      fiber.props
    );
  } else if (fiber.effectTag === "DELETION") {
    domParent.removeChild(fiber.dom);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
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
  // Add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // Create new fibers
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);

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

function reconcileChildren(wipFiber: Fiber, elements: DidactElement[]) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling: Fiber | undefined = undefined;

  while (index < elements.length || oldFiber !== undefined) {
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
};

/** @jsx Didact.createElement */
const element = (
  <div id="foo">
    <a>bar</a>
    <b />
  </div>
);

const container = document.getElementById("root");
if (!container) throw new Error("No root Element");

Didact.render(element, container);
