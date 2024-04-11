type DidactText = string | number;
type DidactChild = DidactElement | DidactText;

type DidactElement = {
  type: string;
  props: DidactProps;
};

type DidactProps = {
  nodeValue?: DidactText;
  children?: DidactElement[];
  [key: string]: any;
} | null;

function createElement(
  type: string,
  props: DidactProps = { children: [] },
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
  if (element.props === null) return;

  if (element.type === "TEXT_ELEMENT") {
    const dom = document.createTextNode(
      typeof element.props.nodeValue === "string" ? element.props.nodeValue : ""
    );
    container.appendChild(dom);
    return;
  }

  const dom = document.createElement(element.type);
  const isProperty = (key: string) => key !== "children";

  Object.keys(element.props)
    .filter(isProperty)
    .forEach((name) => {
      if (element.props === null) return;
      dom.setAttribute(name, element.props[name]);
    });

  if (Array.isArray(element.props.children)) {
    element.props.children.forEach((child) => render(child, dom));
  }

  container.appendChild(dom);
}

const Didact = {
  createElement,
  render,
};

const element = Didact.createElement(
  "div",
  { id: "foo" },
  Didact.createElement("a", null, "bar"),
  Didact.createElement("b")
);

const container = document.getElementById("root");
if (!container) throw new Error("No root Element");

Didact.render(element, container);
