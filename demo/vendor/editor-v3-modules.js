var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: !0 });
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/audio/parse-elem-html.ts
var parse_elem_html_exports = {};
__export(parse_elem_html_exports, {
  parseHtmlConf: () => parseHtmlConf
});
function parseHtml(elem, _children, _editor) {
  return {
    type: "audio",
    src: elem.querySelector("cp-audio-player")?.getAttribute("src") || elem.querySelector("audio")?.getAttribute("src") || elem.querySelector("audio")?.querySelector("source")?.getAttribute("src") || "",
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
  let { src } = elemNode;
  return `<div data-w-e-type="audio"><cp-audio-player src="${src}" style="margin:0 auto;"/></div>`;
}
var audioToHtmlConf = {
  type: "audio",
  elemToHtml: audioToHtml
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/audio/plugin.ts
import { DomEditor, SlateTransforms } from "@wangeditor-next/editor";
function withAudio(editor) {
  let { isVoid, normalizeNode } = editor, newEditor = editor;
  return newEditor.isVoid = (elem) => {
    let { type } = elem;
    return type === "audio" ? !1 : isVoid(elem);
  }, newEditor.normalizeNode = ([node, path]) => (DomEditor.getNodeType(node) === "audio" && DomEditor.isLastNode(newEditor, node) && SlateTransforms.insertNodes(newEditor, DomEditor.genEmptyParagraph(), {
    at: [path[0] + 1]
  }), normalizeNode([node, path])), newEditor;
}
var plugin_default = withAudio;

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/insert-answer-box/parse-elem-html.ts
var parse_elem_html_exports2 = {};
__export(parse_elem_html_exports2, {
  parseHtmlConf: () => parseHtmlConf2
});
function normalizeIndex(value) {
  let num = Number.parseInt(value ?? "", 10);
  return !Number.isFinite(num) || num < 1 ? 1 : num;
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
  let num = Number.parseInt(String(value ?? ""), 10);
  return !Number.isFinite(num) || num < 1 ? 1 : num;
}
function insertAnswerBoxToHtml(elemNode) {
  let { index } = elemNode;
  return `<answer-box index="${normalizeIndex2(index)}"></answer-box>`;
}
var insertAnswerBoxToHtmlConf = {
  type: "insert-answer-box",
  elemToHtml: insertAnswerBoxToHtml
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/insert-answer-box/plugin.ts
import { DomEditor as DomEditor2, SlateTransforms as SlateTransforms2 } from "@wangeditor-next/editor";
function removeSelectedAnswerBox(editor) {
  let selectedElem = DomEditor2.getSelectedElems(editor).find((elem) => DomEditor2.getNodeType(elem) === "insert-answer-box");
  if (!selectedElem)
    return !1;
  let path = DomEditor2.findPath(editor, selectedElem);
  return SlateTransforms2.removeNodes(editor, { at: path }), !0;
}
function withInsertAnswerBox(editor) {
  let { isVoid, normalizeNode, deleteBackward, deleteForward } = editor, newEditor = editor;
  return newEditor.isVoid = (elem) => elem.type === "insert-answer-box" ? !0 : isVoid(elem), newEditor.normalizeNode = ([node, path]) => (DomEditor2.getNodeType(node) === "insert-answer-box" && DomEditor2.isLastNode(newEditor, node) && SlateTransforms2.insertNodes(newEditor, DomEditor2.genEmptyParagraph(), {
    at: [path[0] + 1]
  }), normalizeNode([node, path])), newEditor.deleteBackward = (...args) => {
    removeSelectedAnswerBox(newEditor) || deleteBackward.apply(newEditor, args);
  }, newEditor.deleteForward = (...args) => {
    removeSelectedAnswerBox(newEditor) || deleteForward.apply(newEditor, args);
  }, newEditor;
}
var plugin_default2 = withInsertAnswerBox;

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/proxy-browser/parse-elem-html.ts
var parse_elem_html_exports3 = {};
__export(parse_elem_html_exports3, {
  parseHtmlConf: () => parseHtmlConf3
});
function parseHtml3(elem, _children, _editor) {
  return {
    type: "proxyBrowser",
    objectId: elem.getAttribute("object-id") || elem.querySelector("proxy-browser")?.getAttribute("object-id") || "",
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
  let { objectId } = elemNode;
  return `<div data-w-e-type="proxyBrowser" style="margin:8px 0;"><proxy-browser object-id="${objectId}"></proxy-browser></div>`;
}
var proxyBrowserToHtmlConf = {
  type: "proxyBrowser",
  elemToHtml: proxyBrowserToHtml
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/proxy-browser/plugin.ts
import { DomEditor as DomEditor3, SlateTransforms as SlateTransforms3 } from "@wangeditor-next/editor";
function withProxyBrowser(editor) {
  let { isVoid, normalizeNode } = editor, newEditor = editor;
  return newEditor.isVoid = (elem) => {
    let { type } = elem;
    return type === "proxyBrowser" ? !0 : isVoid(elem);
  }, newEditor.normalizeNode = ([node, path]) => (DomEditor3.getNodeType(node) === "proxyBrowser" && DomEditor3.isLastNode(newEditor, node) && SlateTransforms3.insertNodes(newEditor, DomEditor3.genEmptyParagraph(), {
    at: [path[0] + 1]
  }), normalizeNode([node, path])), newEditor;
}
var plugin_default3 = withProxyBrowser;

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/shadow-dom/parse-elem-html.ts
var parse_elem_html_exports4 = {};
__export(parse_elem_html_exports4, {
  parseHtmlConf: () => parseHtmlConf4
});
function styleStringToObject(str) {
  let obj = {};
  return str.split(";").forEach((item) => {
    let [key, value] = item.split(":").map((s) => s.trim());
    key && value !== void 0 && (obj[key] = value);
  }), obj;
}
var parseHtmlConf4 = {
  selector: 'div[data-w-e-type="shadow-dom"]',
  parseElemHtml: (elem, _children, _editor) => {
    let childEls = elem.children, doms = [];
    return Array.from(childEls).forEach((t) => {
      let attrs = {};
      Array.from(t.attributes).forEach((tt) => {
        tt.name === "style" ? attrs[tt.name] = styleStringToObject(tt.value) : attrs[tt.name] = tt.value;
      }), doms.push({
        tag: t.tagName.toLocaleLowerCase(),
        attrs,
        html: t.innerHTML
      });
    }), {
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
    let { doms } = elemNode;
    return `<div data-w-e-type="shadow-dom">${doms.map((t) => {
      let { tag, attrs, html } = t, attr = "";
      for (let key in attrs)
        attr += `${key}="${attrs[key]}"`;
      return `<${tag} ${attr}>${html}</${tag}>`;
    }).join("")}</div>`;
  }
};

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/shadow-dom/plugin.ts
function withShadowDom(editor) {
  let { isVoid } = editor, newEditor = editor;
  return newEditor.isVoid = (elem) => {
    let { type } = elem;
    return type === "shadow-dom" ? !1 : isVoid(elem);
  }, newEditor;
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
    let nextChildren = children.filter((child) => SlateText.isText(child) ? !0 : editor.isInline(child));
    return nextChildren.length === 0 && (nextChildren = [
      {
        text: (elem.textContent ?? "").replace(/\s+/g, " ").trim()
      }
    ]), {
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
  return (_elemNode, childrenHtml) => `<div data-w-e-type="${type}">${childrenHtml}</div>`;
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
var HEADER_TYPES = ["header1", "header2", "header3", "header4", "header5", "header6"], TEXT_PARSE_TYPE_SET = new Set(TEXT_PARSE_TYPES), HEADER_TYPE_SET = new Set(HEADER_TYPES);
function isTextParseType(type) {
  return TEXT_PARSE_TYPE_SET.has(type);
}

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/text-parse/plugin.ts
function withTextParse(editor) {
  let { insertBreak } = editor, newEditor = editor;
  return newEditor.insertBreak = () => {
    let [match] = SlateEditor2.nodes(newEditor, {
      match: (node) => {
        let type = DomEditor5.getNodeType(node);
        return isTextParseType(type);
      },
      universal: !0
    });
    if (!match) {
      insertBreak();
      return;
    }
    if (DomEditor5.isSelectionAtLineEnd(newEditor, match[1])) {
      SlateTransforms5.insertNodes(newEditor, DomEditor5.genEmptyParagraph(), {
        mode: "highest"
      });
      return;
    }
    insertBreak();
  }, newEditor;
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
  let videoRatio = style["--video-ratio"];
  return videoRatio ? `${styleStr}--video-ratio: ${videoRatio};` : styleStr;
}
function genSizeStyledIframeHtml(iframeHtml, width = "auto", height = "auto", style = {}, classMode = !1) {
  let iframe = new DOMParser().parseFromString(iframeHtml, "text/html").querySelector("iframe");
  if (!iframe)
    return iframeHtml;
  let { width: styleWidth = "", height: styleHeight = "" } = style;
  if (iframe.setAttribute("width", width), iframe.setAttribute("height", height), classMode)
    styleWidth && iframe.setAttribute("data-w-e-style-width", styleWidth), styleHeight && iframe.setAttribute("data-w-e-style-height", styleHeight), iframe.removeAttribute("style"), style["--video-ratio"] && iframe.setAttribute("style", appendVideoRatioStyle("", style));
  else {
    let styleStr = "";
    styleWidth && (styleStr += `width: ${styleWidth};`), styleHeight && (styleStr += `height: ${styleHeight};`), iframe.setAttribute("style", appendVideoRatioStyle(styleStr, style));
  }
  return iframe.outerHTML;
}
function genVideoStyle(style = {}, classMode = !1) {
  let { width = "", height = "" } = style;
  if (classMode)
    return {
      styleAttr: style["--video-ratio"] ? ` style="${appendVideoRatioStyle("", style)}"` : "",
      widthData: width ? ` data-w-e-style-width="${width}"` : "",
      heightData: height ? ` data-w-e-style-height="${height}"` : ""
    };
  let styleStr = "";
  return width && (styleStr += `width: ${width};`), height && (styleStr += `height: ${height};`), {
    styleAttr: ` style="${appendVideoRatioStyle(styleStr, style)}"`,
    widthData: "",
    heightData: ""
  };
}

// ../../jcjy/sd-pc-front/src/components-base/editor-v3/module/video/elem-to-html.ts
function getVideoAlignClass(textAlign) {
  let align = (textAlign || "").trim().toLowerCase();
  return align && ["left", "center", "right", "justify"].includes(align) ? `w-e-video-align-${align}` : "w-e-video-align-center";
}
function videoToHtml(elemNode, _childrenHtml, editor) {
  let {
    src = "",
    poster = "",
    width = "auto",
    height = "auto",
    style = {},
    textAlign = "center"
  } = elemNode, mode = getTextStyleMode(editor), containerAlign = textAlign || "center", alignData = ` data-w-e-text-align="${containerAlign}"`, res = `<div data-w-e-type="video" data-w-e-is-void${mode === "class" ? ` class="${getVideoAlignClass(containerAlign)}"${alignData}` : ` style="text-align: ${containerAlign};"`}>
`;
  if (src.trim().indexOf("<iframe ") === 0) {
    let iframeHtml = genSizeStyledIframeHtml(src, width, height, style, mode === "class");
    res += iframeHtml;
  } else {
    let { styleAttr, widthData, heightData } = genVideoStyle(style, mode === "class");
    res += `<video poster="${poster}" controls="true" width="${width}" height="${height}"${widthData}${heightData}${styleAttr}><source src="${src}" type="video/mp4"/></video>`;
  }
  return res += `
</div>`, res;
}
var videoToHtmlConf = {
  type: "video",
  elemToHtml: videoToHtml
};

// editor-v3-modules.generated.ts
var isParseConf = (v) => !!v && typeof v == "object" && typeof v.selector == "string" && typeof v.parseElemHtml == "function", isToHtmlConf = (v) => !!v && typeof v == "object" && typeof v.type == "string" && typeof v.elemToHtml == "function";
function collect(ns, test) {
  let out = [];
  for (let value of Object.values(ns ?? {}))
    if (Array.isArray(value))
      for (let item of value) test(item) && out.push(item);
    else test(value) && out.push(value);
  return out;
}
function composePlugins(plugins) {
  if (plugins.length !== 0)
    return (editor) => plugins.reduce((acc, plugin) => plugin(acc), editor);
}
var editorV3NodeModules = [], allParse = [], allToHtml = [], allSelectors = [], allTypes = [];
{
  let parse = collect(parse_elem_html_exports, isParseConf), toHtml = collect(elem_to_html_exports, isToHtmlConf), plugins = [plugin_default].filter((p) => typeof p == "function");
  allParse.push(...parse), allToHtml.push(...toHtml);
  for (let conf of parse) allSelectors.push(conf.selector);
  for (let conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  let parse = collect(parse_elem_html_exports2, isParseConf), toHtml = collect(elem_to_html_exports2, isToHtmlConf), plugins = [plugin_default2].filter((p) => typeof p == "function");
  allParse.push(...parse), allToHtml.push(...toHtml);
  for (let conf of parse) allSelectors.push(conf.selector);
  for (let conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  let parse = collect(parse_elem_html_exports3, isParseConf), toHtml = collect(elem_to_html_exports3, isToHtmlConf), plugins = [plugin_default3].filter((p) => typeof p == "function");
  allParse.push(...parse), allToHtml.push(...toHtml);
  for (let conf of parse) allSelectors.push(conf.selector);
  for (let conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  let parse = collect(parse_elem_html_exports4, isParseConf), toHtml = collect(elem_to_html_exports4, isToHtmlConf), plugins = [plugin_default4].filter((p) => typeof p == "function");
  allParse.push(...parse), allToHtml.push(...toHtml);
  for (let conf of parse) allSelectors.push(conf.selector);
  for (let conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  let parse = collect(parse_elem_html_exports5, isParseConf), toHtml = collect(elem_to_html_exports5, isToHtmlConf), plugins = [plugin_default5].filter((p) => typeof p == "function");
  allParse.push(...parse), allToHtml.push(...toHtml);
  for (let conf of parse) allSelectors.push(conf.selector);
  for (let conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
{
  let parse = [], toHtml = collect(elem_to_html_exports6, isToHtmlConf), plugins = [];
  allParse.push(...parse), allToHtml.push(...toHtml);
  for (let conf of parse) allSelectors.push(conf.selector);
  for (let conf of toHtml) allTypes.push(conf.type);
  editorV3NodeModules.push({
    parseElemsHtml: parse,
    elemsToHtml: toHtml,
    editorPlugin: composePlugins(plugins)
  });
}
var EDITOR_V3_CUSTOM_TYPES = [...new Set(allTypes)].sort(), EDITOR_V3_PARSE_SELECTORS = [...new Set(allSelectors)].sort(), EDITOR_V3_SOURCE = "/Users/mac/Documents/code/jcjy/sd-pc-front/src/components-base/editor-v3", EDITOR_V3_SUMMARY = {
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
