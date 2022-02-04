import { Progress, Task } from "./interfaces";
import { Token, TokenTypes } from "./tokens";
import { v4 as uuid } from "uuid";
import { Lexer } from "./lexer";

export class ParserError extends Error {
  name = "ParserError";
}

export interface ParsedChecklist {
  metadata: Metadata;
  content: Task[];
  progress: Progress;
}

export interface Options {
  auto_id: boolean;
}

interface Metadata {
  id: string;
  version: string;
  creator: string;
  last_modified: string;
  [key: string]: string;

  sign: string;
}

interface State {
  list_item_head_stack: {
    task: Task;
    indent: number;
  }[];

  section: "metadata" | "content" | "progress";
  metadata: Metadata;
  content: Task[];
  options: Partial<Options>;
}

export class Parser {
  static parse(
    tokens: Token<any>[],
    options: Partial<Options> = { auto_id: true }
  ) {
    const state: State = {
      list_item_head_stack: [],

      options,
      section: "metadata",
      metadata: {
        id: "",
        version: "0.0.1",
        creator: "",
        last_modified: "",
        sign: "",
      },
      content: [],
    };

    for (const token of tokens) {
      switch (token.type) {
        case TokenTypes.SECTION_HEAD:
          this.parseSectionHeader(token, state);
          break;
        case TokenTypes.METADATA_ENTRY:
          this.parseMetadataEntry(token, state);
          break;
        case TokenTypes.LIST_ITEM:
          this.parseListItem(token, state);
          break;
      }
    }

    const checklist: ParsedChecklist = {
      metadata: state.metadata,
      content: state.content,
      progress: {},
    };

    return checklist;
  }

  private static parseSectionHeader(token: Token, state: State) {
    const label = token.value as string;
    if (label != "metadata" && label != "content" && label != "progress")
      throw new Error(`Unrecognized section header ${label}.`);
    state.section = label;
  }

  private static parseMetadataEntry(
    token: Token<{ key: string; value: string }>,
    state: State
  ) {
    if (state.section != "metadata")
      throw new Error("Invalid token metadata position.");
    const { key, value } = token.value;
    state.metadata[key] = value;
  }

  private static parseListItem(
    token: Token<{
      label: string;
      indent: number;
      sequence_type: "ordered" | "unordered";
      progress_type: "universal" | "existential";
      props: { [key: string]: string };
    }>,
    state: State
  ) {
    if (state.section != "content")
      throw new Error("Invalid token metadata position.");

    const { label, indent, sequence_type, progress_type, props } = token.value;

    const id =
      props.id ?? (state.options.auto_id ? this.generateID() : undefined);
    if (!id)
      throw new ParserError(
        `Item '${label}' has no id. You can turn on auto_id to generate id automatically.`
      );

    const task: Task = {
      id,
      type: "BASIC",
      sequence_type: sequence_type == "ordered" ? "ORDERED" : "UNORDERED",
      progress_type: progress_type == "universal" ? "UNIVERSAL" : "EXISTENSIAL",
      label,
      children: [],
      attrs: props,
    };

    const head_indent = state.list_item_head_stack.at(-1)?.indent ?? 0;
    const head_task = state.list_item_head_stack.at(-1)?.task;

    if (indent == head_indent) {
      // First time
      if (!head_task) {
        state.content.push(task);
      } else {
        state.list_item_head_stack.pop();
        const parent = state.list_item_head_stack.at(-1);
        if (parent) parent.task.children.push(task);
        else state.content.push(task);
      }
      state.list_item_head_stack.push({ task, indent });
    } else if (indent > head_indent) {
      if (!head_task) {
        state.content.push(task);
      } else {
        head_task.children.push(task);
      }
      state.list_item_head_stack.push({ task, indent });
    } else {
      if (!head_task) throw new Error("This is impossible to happen.");

      while (true) {
        const current_parent = state.list_item_head_stack.at(-1);
        if (current_parent) {
          if (current_parent.task.attrs["ref"])
            current_parent.task.type = "FOREIGN";
          if (current_parent.task.children.length)
            current_parent.task.type = "PARENT";
        }
        state.list_item_head_stack.pop();
        const current_indent = state.list_item_head_stack.at(-1)?.indent ?? 0;
        if (state.list_item_head_stack.length == 0) break;
        if (current_indent < indent) break;
      }

      const parent = state.list_item_head_stack.at(-1);
      if (parent) parent.task.children.push(task);
      else state.content.push(task);
      state.list_item_head_stack.push({ task, indent });
    }
  }

  private static generateID() {
    return uuid().slice(0, 5);
  }
}
