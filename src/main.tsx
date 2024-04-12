type DidactText = string | number;
type DidactChild = DidactElement | DidactText;

type DidactElement = {
  type: string;
  props: DidactProps;
};

type DidactProps = {
  nodeValue?: DidactText;
  children: DidactElement[];
  [key: string]: any;
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

function render(element: DidactElement, container: HTMLElement) {
  if (element.type === "TEXT_ELEMENT") {
    const dom = document.createTextNode(
      typeof element.props.nodeValue === "string" ? element.props.nodeValue : ""
    );
    container.appendChild(dom);
    return;
  }

  const dom = document.createElement(element.type);
  const isProperty = (key: string) =>
    key !== "children" && key !== "__self" && key !== "__source";

  Object.keys(element.props)
    .filter(isProperty)
    .forEach((name) => {
      dom.setAttribute(name, element.props[name]);
    });

  element.props.children.forEach((child) => render(child, dom));

  container.appendChild(dom);
}

let nextUnitOfWork: unknown = null;

function workLoop(deadline: IdleDeadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function performUnitOfWork(nextUnitOfWork: unknown) {
  // TODO
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
