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
  props: DidactProps = {},
  ...children: DidactChild[]
) {
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

function createTextElement(text: DidactText) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

const Didact = {
  createElement,
};

const element = Didact.createElement(
  "div",
  { id: "foo" },
  Didact.createElement("a", null, "bar"),
  Didact.createElement("b")
);
console.log("element = ", element);

const container = document.getElementById("root");
if (!container) throw new Error("No root Element");
