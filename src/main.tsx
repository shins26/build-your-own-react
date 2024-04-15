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
  const isProperty = (key: string) =>
    key !== "children" && key !== "__self" && key !== "__source";

  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      dom.setAttribute(name, fiber.props[name]);
    });

  return dom;
}

function render(element: DidactElement, container: HTMLElement): void {
  nextUnitOfWork = {
    type: element.type,
    dom: container,
    props: {
      children: [element],
    },
  };
}

let nextUnitOfWork: Fiber | undefined = undefined;

function workLoop(deadline: IdleDeadline): void {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function performUnitOfWork(fiber: Fiber): Fiber | undefined {
  // add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  if (fiber.parent?.dom) {
    fiber.parent.dom.appendChild(fiber.dom);
  }

  // create new fibers
  const elements = fiber.props.children;
  let prevSibling: Fiber | undefined = undefined;

  for (const element of elements) {
    const newFiber: Fiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: undefined,
    };

    if (!prevSibling) {
      fiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
  }

  // return next unit of work
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
