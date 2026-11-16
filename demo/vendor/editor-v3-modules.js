var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/audio/parse-elem-html.ts
var parse_elem_html_exports = {};
__export(parse_elem_html_exports, {
  parseHtmlConf: () => parseHtmlConf
});
function parseHtml(elem, _children, _editor) {
  const src = elem.querySelector("cp-audio-player")?.getAttribute("src") || elem.querySelector("audio")?.getAttribute("src") || elem.querySelector("audio")?.querySelector("source")?.getAttribute("src") || "";
  return {
    type: "audio",
    src,
    children: [
      {
        text: ""
      }
    ]
  };
}
var parseHtmlConf = {
  selector: 'div[data-w-e-type="audio"]',
  parseElemHtml: parseHtml
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/audio/elem-to-html.ts
var elem_to_html_exports = {};
__export(elem_to_html_exports, {
  audioToHtmlConf: () => audioToHtmlConf
});
function audioToHtml(elemNode) {
  const { src } = elemNode;
  const res = `<div data-w-e-type="audio"><cp-audio-player src="${src}" style="margin:0 auto;"/></div>`;
  return res;
}
var audioToHtmlConf = {
  type: "audio",
  elemToHtml: audioToHtml
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/audio/plugin.ts
import { DomEditor, SlateTransforms } from "@wangeditor-next/editor";
function withAudio(editor) {
  const { isVoid, normalizeNode } = editor;
  const newEditor = editor;
  newEditor.isVoid = (elem) => {
    const { type } = elem;
    if (type === "audio") {
      return false;
    }
    return isVoid(elem);
  };
  newEditor.normalizeNode = ([node, path]) => {
    const type = DomEditor.getNodeType(node);
    if (type === "audio") {
      const isLast = DomEditor.isLastNode(newEditor, node);
      if (isLast) {
        SlateTransforms.insertNodes(newEditor, DomEditor.genEmptyParagraph(), {
          at: [path[0] + 1]
        });
      }
    }
    return normalizeNode([node, path]);
  };
  return newEditor;
}
var plugin_default = withAudio;

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/insert-answer-box/parse-elem-html.ts
var parse_elem_html_exports2 = {};
__export(parse_elem_html_exports2, {
  parseHtmlConf: () => parseHtmlConf2
});
function normalizeIndex(value) {
  const num = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(num) || num < 1) {
    return 1;
  }
  return num;
}
function parseHtml2(elem, _children, _editor) {
  return {
    type: "insert-answer-box",
    index: normalizeIndex(elem.getAttribute("index")),
    children: [{ text: "" }]
  };
}
var parseHtmlConf2 = {
  selector: "answer-box",
  parseElemHtml: parseHtml2
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/insert-answer-box/elem-to-html.ts
var elem_to_html_exports2 = {};
__export(elem_to_html_exports2, {
  insertAnswerBoxToHtmlConf: () => insertAnswerBoxToHtmlConf
});
function normalizeIndex2(value) {
  const num = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(num) || num < 1) {
    return 1;
  }
  return num;
}
function insertAnswerBoxToHtml(elemNode) {
  const { index } = elemNode;
  return `<answer-box index="${normalizeIndex2(index)}"></answer-box>`;
}
var insertAnswerBoxToHtmlConf = {
  type: "insert-answer-box",
  elemToHtml: insertAnswerBoxToHtml
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/insert-answer-box/plugin.ts
import { DomEditor as DomEditor2, SlateTransforms as SlateTransforms2 } from "@wangeditor-next/editor";
function removeSelectedAnswerBox(editor) {
  const selectedElem = DomEditor2.getSelectedElems(editor).find((elem) => {
    return DomEditor2.getNodeType(elem) === "insert-answer-box";
  });
  if (!selectedElem) {
    return false;
  }
  const path = DomEditor2.findPath(editor, selectedElem);
  SlateTransforms2.removeNodes(editor, { at: path });
  return true;
}
function withInsertAnswerBox(editor) {
  const { isVoid, normalizeNode, deleteBackward, deleteForward } = editor;
  const newEditor = editor;
  newEditor.isVoid = (elem) => {
    if (elem.type === "insert-answer-box") {
      return true;
    }
    return isVoid(elem);
  };
  newEditor.normalizeNode = ([node, path]) => {
    const type = DomEditor2.getNodeType(node);
    if (type === "insert-answer-box") {
      const isLast = DomEditor2.isLastNode(newEditor, node);
      if (isLast) {
        SlateTransforms2.insertNodes(newEditor, DomEditor2.genEmptyParagraph(), {
          at: [path[0] + 1]
        });
      }
    }
    return normalizeNode([node, path]);
  };
  newEditor.deleteBackward = (...args) => {
    if (removeSelectedAnswerBox(newEditor)) {
      return;
    }
    deleteBackward.apply(newEditor, args);
  };
  newEditor.deleteForward = (...args) => {
    if (removeSelectedAnswerBox(newEditor)) {
      return;
    }
    deleteForward.apply(newEditor, args);
  };
  return newEditor;
}
var plugin_default2 = withInsertAnswerBox;

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/proxy-browser/parse-elem-html.ts
var parse_elem_html_exports3 = {};
__export(parse_elem_html_exports3, {
  parseHtmlConf: () => parseHtmlConf3
});
function parseHtml3(elem, _children, _editor) {
  const objectId = elem.getAttribute("object-id") || elem.querySelector("proxy-browser")?.getAttribute("object-id") || "";
  return {
    type: "proxyBrowser",
    objectId,
    children: [{ text: "" }]
  };
}
var parseHtmlConf3 = {
  selector: 'div[data-w-e-type="proxyBrowser"]',
  parseElemHtml: parseHtml3
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/proxy-browser/elem-to-html.ts
var elem_to_html_exports3 = {};
__export(elem_to_html_exports3, {
  proxyBrowserToHtmlConf: () => proxyBrowserToHtmlConf
});
function proxyBrowserToHtml(elemNode) {
  const { objectId } = elemNode;
  const res = `<div data-w-e-type="proxyBrowser" style="margin:8px 0;"><proxy-browser object-id="${objectId}"></proxy-browser></div>`;
  return res;
}
var proxyBrowserToHtmlConf = {
  type: "proxyBrowser",
  elemToHtml: proxyBrowserToHtml
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/proxy-browser/plugin.ts
import { DomEditor as DomEditor3, SlateTransforms as SlateTransforms3 } from "@wangeditor-next/editor";
function withProxyBrowser(editor) {
  const { isVoid, normalizeNode } = editor;
  const newEditor = editor;
  newEditor.isVoid = (elem) => {
    const { type } = elem;
    if (type === "proxyBrowser") {
      return true;
    }
    return isVoid(elem);
  };
  newEditor.normalizeNode = ([node, path]) => {
    const type = DomEditor3.getNodeType(node);
    if (type === "proxyBrowser") {
      const isLast = DomEditor3.isLastNode(newEditor, node);
      if (isLast) {
        SlateTransforms3.insertNodes(newEditor, DomEditor3.genEmptyParagraph(), {
          at: [path[0] + 1]
        });
      }
    }
    return normalizeNode([node, path]);
  };
  return newEditor;
}
var plugin_default3 = withProxyBrowser;

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/shadow-dom/parse-elem-html.ts
var parse_elem_html_exports4 = {};
__export(parse_elem_html_exports4, {
  parseHtmlConf: () => parseHtmlConf4
});
function styleStringToObject(str) {
  const obj = {};
  str.split(";").forEach((item) => {
    const [key, value] = item.split(":").map((s) => s.trim());
    if (key && value !== void 0) {
      obj[key] = value;
    }
  });
  return obj;
}
var parseHtmlConf4 = {
  selector: 'div[data-w-e-type="shadow-dom"]',
  parseElemHtml: (elem, _children, _editor) => {
    const childEls = elem.children;
    const doms = [];
    console.log("parse", elem);
    Array.from(childEls).forEach((t) => {
      const attrs = {};
      Array.from(t.attributes).forEach((tt) => {
        if (tt.name === "style") {
          attrs[tt.name] = styleStringToObject(tt.value);
        } else {
          attrs[tt.name] = tt.value;
        }
      });
      doms.push({
        tag: t.tagName.toLocaleLowerCase(),
        attrs,
        html: t.innerHTML
      });
    });
    return {
      type: "shadow-dom",
      doms,
      children: [
        {
          text: ""
        }
      ]
    };
  }
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/shadow-dom/elem-to-html.ts
var elem_to_html_exports4 = {};
__export(elem_to_html_exports4, {
  shadowDomToHtmlConf: () => shadowDomToHtmlConf
});
var shadowDomToHtmlConf = {
  type: "shadow-dom",
  elemToHtml: (elemNode) => {
    console.log("elem-to-html", elemNode);
    const { doms } = elemNode;
    const children = doms.map((t) => {
      const { tag, attrs, html } = t;
      let attr = "";
      for (const key in attrs) {
        attr += `${key}="${attrs[key]}"`;
      }
      return `<${tag} ${attr}>${html}</${tag}>`;
    });
    const res = `<div data-w-e-type="shadow-dom">${children.join("")}</div>`;
    return res;
  }
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/shadow-dom/plugin.ts
function withShadowDom(editor) {
  const { isVoid } = editor;
  const newEditor = editor;
  newEditor.isVoid = (elem) => {
    const { type } = elem;
    if (type === "shadow-dom") {
      return false;
    }
    return isVoid(elem);
  };
  return newEditor;
}
var plugin_default4 = withShadowDom;

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/text-parse/parse-elem-html.ts
var parse_elem_html_exports5 = {};
__export(parse_elem_html_exports5, {
  parseTextParseHtmlConfs: () => parseTextParseHtmlConfs
});
import { SlateText } from "@wangeditor-next/editor";

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/text-parse/custom-types.ts
var TEXT_PARSE_TYPES = [
  "textParseTaskTitle",
  "textParseTaskContent",
  "textParsePrompt",
  "textParsePromptElement",
  "textParsePromptElementContent",
  "textParseQuestionKeywordTitle",
  "textParseQuestionKeywordContent",
  "textParseSubmitTaskNotice",
  "textParseWorkOrderTitle",
  "textParseWorkOrderContent",
  "textParseSubmitContent",
  "textParseTaskDescription",
  "textParseContent",
  "textParseQuestionKeyword",
  "textParsePromptContent",
  "textParseEmphasis"
];

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/text-parse/parse-elem-html.ts
function genParser(type) {
  return (elem, children, editor) => {
    let nextChildren = children.filter((child) => {
      if (SlateText.isText(child)) {
        return true;
      }
      return editor.isInline(child);
    });
    if (nextChildren.length === 0) {
      nextChildren = [
        {
          text: (elem.textContent ?? "").replace(/\s+/g, " ").trim()
        }
      ];
    }
    return {
      type,
      children: nextChildren
    };
  };
}
var parseTextParseHtmlConfs = TEXT_PARSE_TYPES.map((type) => ({
  selector: `div[data-w-e-type="${type}"]`,
  parseElemHtml: genParser(type)
}));

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/text-parse/elem-to-html.ts
var elem_to_html_exports5 = {};
__export(elem_to_html_exports5, {
  textParseToHtmlConfs: () => textParseToHtmlConfs
});
function genToHtmlFn(type) {
  return (_elemNode, childrenHtml) => {
    return `<div data-w-e-type="${type}">${childrenHtml}</div>`;
  };
}
var textParseToHtmlConfs = TEXT_PARSE_TYPES.map((type) => ({
  type,
  elemToHtml: genToHtmlFn(type)
}));

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/text-parse/plugin.ts
import { DomEditor as DomEditor5, SlateEditor as SlateEditor2, SlateTransforms as SlateTransforms5 } from "@wangeditor-next/editor";

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/text-parse/helper.ts
import {
  DomEditor as DomEditor4,
  SlateEditor,
  SlateText as SlateText2,
  SlateTransforms as SlateTransforms4
} from "@wangeditor-next/editor";
var HEADER_TYPES = ["header1", "header2", "header3", "header4", "header5", "header6"];
var TEXT_PARSE_TYPE_SET = new Set(TEXT_PARSE_TYPES);
var HEADER_TYPE_SET = new Set(HEADER_TYPES);
function isTextParseType(type) {
  return TEXT_PARSE_TYPE_SET.has(type);
}

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/text-parse/plugin.ts
function withTextParse(editor) {
  const { insertBreak } = editor;
  const newEditor = editor;
  newEditor.insertBreak = () => {
    const [match] = SlateEditor2.nodes(newEditor, {
      match: (node) => {
        const type = DomEditor5.getNodeType(node);
        return isTextParseType(type);
      },
      universal: true
    });
    if (!match) {
      insertBreak();
      return;
    }
    const isAtLineEnd = DomEditor5.isSelectionAtLineEnd(newEditor, match[1]);
    if (isAtLineEnd) {
      SlateTransforms5.insertNodes(newEditor, DomEditor5.genEmptyParagraph(), {
        mode: "highest"
      });
      return;
    }
    insertBreak();
  };
  return newEditor;
}
var plugin_default5 = withTextParse;

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/video/elem-to-html.ts
var elem_to_html_exports6 = {};
__export(elem_to_html_exports6, {
  videoToHtmlConf: () => videoToHtmlConf
});
import { getTextStyleMode } from "@wangeditor-next/editor";

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/video/utils/dom.ts
function appendVideoRatioStyle(styleStr, style) {
  const videoRatio = style["--video-ratio"];
  if (!videoRatio) {
    return styleStr;
  }
  return `${styleStr}--video-ratio: ${videoRatio};`;
}
function genSizeStyledIframeHtml(iframeHtml, width = "auto", height = "auto", style = {}, classMode = false) {
  const doc = new DOMParser().parseFromString(iframeHtml, "text/html");
  const iframe = doc.querySelector("iframe");
  if (!iframe) {
    return iframeHtml;
  }
  const { width: styleWidth = "", height: styleHeight = "" } = style;
  iframe.setAttribute("width", width);
  iframe.setAttribute("height", height);
  if (!classMode) {
    let styleStr = "";
    if (styleWidth) {
      styleStr += `width: ${styleWidth};`;
    }
    if (styleHeight) {
      styleStr += `height: ${styleHeight};`;
    }
    iframe.setAttribute("style", appendVideoRatioStyle(styleStr, style));
  } else {
    if (styleWidth) {
      iframe.setAttribute("data-w-e-style-width", styleWidth);
    }
    if (styleHeight) {
      iframe.setAttribute("data-w-e-style-height", styleHeight);
    }
    iframe.removeAttribute("style");
    if (style["--video-ratio"]) {
      iframe.setAttribute("style", appendVideoRatioStyle("", style));
    }
  }
  return iframe.outerHTML;
}
function genVideoStyle(style = {}, classMode = false) {
  const { width = "", height = "" } = style;
  if (classMode) {
    return {
      styleAttr: style["--video-ratio"] ? ` style="${appendVideoRatioStyle("", style)}"` : "",
      widthData: width ? ` data-w-e-style-width="${width}"` : "",
      heightData: height ? ` data-w-e-style-height="${height}"` : ""
    };
  }
  let styleStr = "";
  if (width) {
    styleStr += `width: ${width};`;
  }
  if (height) {
    styleStr += `height: ${height};`;
  }
  return {
    styleAttr: ` style="${appendVideoRatioStyle(styleStr, style)}"`,
    widthData: "",
    heightData: ""
  };
}

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/video/elem-to-html.ts
function getVideoAlignClass(textAlign) {
  const align = (textAlign || "").trim().toLowerCase();
  if (!align) {
    return "w-e-video-align-center";
  }
  if (["left", "center", "right", "justify"].includes(align)) {
    return `w-e-video-align-${align}`;
  }
  return "w-e-video-align-center";
}
function videoToHtml(elemNode, _childrenHtml, editor) {
  const {
    src = "",
    poster = "",
    width = "auto",
    height = "auto",
    style = {},
    textAlign = "center"
  } = elemNode;
  const mode = getTextStyleMode(editor);
  const containerAlign = textAlign || "center";
  const alignData = ` data-w-e-text-align="${containerAlign}"`;
  const containerAttrs = mode === "class" ? ` class="${getVideoAlignClass(containerAlign)}"${alignData}` : ` style="text-align: ${containerAlign};"`;
  let res = `<div data-w-e-type="video" data-w-e-is-void${containerAttrs}>
`;
  if (src.trim().indexOf("<iframe ") === 0) {
    const iframeHtml = genSizeStyledIframeHtml(src, width, height, style, mode === "class");
    res += iframeHtml;
  } else {
    const { styleAttr, widthData, heightData } = genVideoStyle(style, mode === "class");
    res += `<video poster="${poster}" controls="true" width="${width}" height="${height}"${widthData}${heightData}${styleAttr}><source src="${src}" type="video/mp4"/></video>`;
  }
  res += "\n</div>";
  return res;
}
var videoToHtmlConf = {
  type: "video",
  elemToHtml: videoToHtml
};

// editor-v3-modules.generated.ts
var isParseConf = (v) => !!v && typeof v === "object" && typeof v.selector === "string" && typeof v.parseElemHtml === "function";
var isToHtmlConf = (v) => !!v && typeof v === "object" && typeof v.type === "string" && typeof v.elemToHtml === "function";
function collect(ns, test) {
  const out = [];
  for (const value of Object.values(ns ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) if (test(item)) out.push(item);
    } else if (test(value)) {
      out.push(value);
    }
  }
  return out;
}
function composePlugins(plugins) {
  if (plugins.length === 0) return void 0;
  return (editor) => plugins.reduce((acc, plugin) => plugin(acc), editor);
}
var editorV3NodeModules = [];
var allParse = [];
var allToHtml = [];
var allSelectors = [];
var allTypes = [];
{
  const parse = collect(parse_elem_html_exports, isParseConf);
  const toHtml = collect(elem_to_html_exports, isToHtmlConf);
  const plugins = [plugin_default].filter((p) => typeof p === "function");
  allParse.push(...parse);
  allToHtml.push(...toHtml);
  for (const conf of parse) allSelectors.push(conf.selector);
  for (const conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  const parse = collect(parse_elem_html_exports2, isParseConf);
  const toHtml = collect(elem_to_html_exports2, isToHtmlConf);
  const plugins = [plugin_default2].filter((p) => typeof p === "function");
  allParse.push(...parse);
  allToHtml.push(...toHtml);
  for (const conf of parse) allSelectors.push(conf.selector);
  for (const conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  const parse = collect(parse_elem_html_exports3, isParseConf);
  const toHtml = collect(elem_to_html_exports3, isToHtmlConf);
  const plugins = [plugin_default3].filter((p) => typeof p === "function");
  allParse.push(...parse);
  allToHtml.push(...toHtml);
  for (const conf of parse) allSelectors.push(conf.selector);
  for (const conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  const parse = collect(parse_elem_html_exports4, isParseConf);
  const toHtml = collect(elem_to_html_exports4, isToHtmlConf);
  const plugins = [plugin_default4].filter((p) => typeof p === "function");
  allParse.push(...parse);
  allToHtml.push(...toHtml);
  for (const conf of parse) allSelectors.push(conf.selector);
  for (const conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  const parse = collect(parse_elem_html_exports5, isParseConf);
  const toHtml = collect(elem_to_html_exports5, isToHtmlConf);
  const plugins = [plugin_default5].filter((p) => typeof p === "function");
  allParse.push(...parse);
  allToHtml.push(...toHtml);
  for (const conf of parse) allSelectors.push(conf.selector);
  for (const conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  const parse = [];
  const toHtml = collect(elem_to_html_exports6, isToHtmlConf);
  const plugins = [];
  allParse.push(...parse);
  allToHtml.push(...toHtml);
  for (const conf of parse) allSelectors.push(conf.selector);
  for (const conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
var EDITOR_V3_CUSTOM_TYPES = [...new Set(allTypes)].sort();
var EDITOR_V3_PARSE_SELECTORS = [...new Set(allSelectors)].sort();
var EDITOR_V3_SOURCE = "/Users/mac/Documents/code/jcjy/sd-pc-front/src/components-base/editor-v3";
var EDITOR_V3_SUMMARY = {
  modules: editorV3NodeModules.length,
  parseConfs: allParse.length,
  toHtmlConfs: allToHtml.length,
  types: EDITOR_V3_CUSTOM_TYPES,
  selectors: EDITOR_V3_PARSE_SELECTORS
};
export {
  EDITOR_V3_CUSTOM_TYPES,
  EDITOR_V3_PARSE_SELECTORS,
  EDITOR_V3_SOURCE,
  EDITOR_V3_SUMMARY,
  editorV3NodeModules
};
