import { State } from "./lexer";

enum TokenTypes {
  SECTION_HEAD = "SECTION_HEAD",
  METADATA_ENTRY = "METADATA_ENTRY",
  LIST_ITEM = "LIST_ITEM",
  LIST_ITEM_TYPE = "LIST_ITEM_TYPE",
  LIST_ITEM_LABEL = "LIST_ITEM_LABEL",
  LIST_ITEM_PROP_LINE = "LIST_ITEM_PROP_LINE",
  LIST_ITEM_PROP_INLINE = "LIST_ITEM_PROP_INLINE",
}

export interface Token<T = string> {
  type: TokenTypes;
  raw: string;
  value: T;
}

const rules: { [label: string]: RegExp } = {
  SECTION_HEAD: /===\s*[a-zA-Z0-9]+\s*===/,
  METADATA_ENTRY: /\s*[a-zA-Z0-9]+\s*=\s*[a-zA-Z0-9]\s*+/,
  LIST_ITEM:
    /^\s*[-*.]\s*[^\n\|]+(\s*\|(\s*[a-zA-Z0-9]*\s*=\s*((\{[^\}]*})|([a-zA-Z0-9]*)),?)+$)*/,
  LIST_ITEM_TYPE: /^\s*[-*.]\s*/,
  LIST_ITEM_LABEL: /^[^\n\|]+/,
  LIST_ITEM_PROP_LINE:
    /(\s*\|(\s*[a-zA-Z0-9]*\s*=\s*((\{[^\}]*})|([a-zA-Z0-9]*)),?)+$)*/,
  LIST_ITEM_PROP_INLINE:
    /(\s*[a-zA-Z0-9\-]*\s*=\s*((\{[^\}]*})|([a-zA-Z0-9\-\_]*)),?)+/,
};

export class Tokenizer {
  // Section start
  static sectionStart(stream: string, state: State): Token | undefined {
    const cap = rules[TokenTypes.SECTION_HEAD].exec(stream);
    if (cap) {
      const raw = cap[0];
      const label = raw.substring(3, raw.length - 3).trim();

      if (label != "metadata" && label != "content" && label != "progress")
        throw new Error(`Unrecognized section named ${label}`);
      state.section = label;

      return {
        type: TokenTypes.SECTION_HEAD,
        raw,
        value: label,
      };
    }
  }

  // Metadata entry
  static metadataEntry(
    stream: string,
    state: State
  ): Token<{ key: string; value: string }> | undefined {
    if (state.section != "metadata") return;

    const cap = rules[TokenTypes.METADATA_ENTRY].exec(stream);
    if (cap) {
      const raw = cap[0];
      const [_key, _value] = raw.split("=");
      const [key, value] = [_key.trim(), _value.trim()];

      return {
        type: TokenTypes.METADATA_ENTRY,
        raw,
        value: { key, value },
      };
    }
  }

  // List item
  static listItem(
    stream: string,
    state: State
  ):
    | Token<{
        label: string;
        indent: number;
        item_type: "universal" | "existential" | "ordered";
        props: { [key: string]: string };
      }>
    | undefined {
    if (state.section != "content") return;

    const cap = rules[TokenTypes.LIST_ITEM].exec(stream);
    if (cap) {
      const raw = cap[0];
      let src = raw;
      const item_type = this.listType(src);
      if (!item_type)
        throw SyntaxError(`Can not determine item type at Line ${state.line}`);
      const marker = item_type.value;
      if (marker != "-" && marker != "." && marker != "*")
        throw SyntaxError(
          `Unrecognized marker: ${marker} at Line ${state.line}`
        );

      src = src.substring(item_type.raw.length);
      const item_label = this.listLabel(src);
      if (!item_label)
        throw SyntaxError(`Can not determine item label at Line ${state.line}`);
      src = src.substring(item_label.raw.length);

      const props: { [key: string]: string } = {};
      const item_props = this.listLineProps(src, state);

      if (item_props)
        for (const k in item_props.value)
          if (item_props.value.hasOwnProperty(k))
            props[k] = item_props.value[k];

      return {
        type: TokenTypes.LIST_ITEM,
        value: {
          item_type:
            marker == "-"
              ? "ordered"
              : marker == "*"
              ? "universal"
              : "existential",
          indent: raw.length - raw.trimStart().length,
          label: item_label.value,
          props,
        },
        raw,
      };
    }
  }

  static listType(stream: string): Token | undefined {
    const cap = rules[TokenTypes.LIST_ITEM_TYPE].exec(stream);
    if (cap) {
      const raw = cap[0];
      return { raw, value: raw.trim(), type: TokenTypes.LIST_ITEM_TYPE };
    }
  }

  static listLabel(stream: string): Token | undefined {
    const cap = rules[TokenTypes.LIST_ITEM_LABEL].exec(stream);
    if (cap) {
      const raw = cap[0];
      return { raw, value: raw.trim(), type: TokenTypes.LIST_ITEM_LABEL };
    }
  }

  static listLineProps(
    stream: string,
    state: State
  ): Token<{ [key: string]: string }> | undefined {
    const cap = rules[TokenTypes.LIST_ITEM_PROP_LINE].exec(stream);
    if (cap) {
      const dic: { [key: string]: string } = {};
      for (let line of cap) {
        line = line.trim();
        if (line[0] == "|") line = line.substring(1);
        line = line.trim();
        const token = this.listInlineProps(line);
        if (!token)
          throw SyntaxError(
            `Can not determine item property at Line ${state.line}`
          );
        for (const k in token.value)
          if (token.value.hasOwnProperty(k)) dic[k] = token.value[k];
      }

      return {
        type: TokenTypes.LIST_ITEM_PROP_LINE,
        raw: stream,
        value: dic,
      };
    }
  }

  static listInlineProps(
    stream: string
  ): Token<{ [key: string]: string }> | undefined {
    const cap = rules[TokenTypes.LIST_ITEM_PROP_INLINE].exec(stream);
    if (cap) {
      const dic: { [key: string]: string } = {};
      for (let _entry of cap) {
        _entry = _entry.trim();
        if (_entry.at(-1) == ",") {
          _entry = _entry.substring(0, _entry.length - 1);
          _entry = _entry.trim();
        }

        let [key, value] = _entry.split("=");
        [key, value] = [key.trim(), value.trim()];

        if (value[0] == "{" && value.at(-1) == "}")
          value = value.substring(1, value.length - 1);
        dic[key] = value;
      }

      return {
        raw: stream,
        value: dic,
        type: TokenTypes.LIST_ITEM_PROP_INLINE,
      };
    }
  }
}
