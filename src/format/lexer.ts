import { Token, Tokenizer } from "./tokens";

export interface State {
  section: "metadata" | "content" | "progress";
  line: number;
}

export class Lexer {
  lex(data: string) {
    const state: State = { section: "metadata", line: 0 };
    const tokens: Token[] = [];

    while (data != "") {
      let token: Token<any> | undefined;

      // section start
      if ((token = Tokenizer.sectionStart(data, state))) {
        data = this._updateState(tokens, data, state, token);
        continue;
      }

      // metadata
      if ((token = Tokenizer.metadataEntry(data, state))) {
        data = this._updateState(tokens, data, state, token);
        continue;
      }

      // list item
      if ((token = Tokenizer.listItem(data, state))) {
        data = this._updateState(tokens, data, state, token);
        continue;
      }

      throw new SyntaxError(`Unknown token at line ${state.line}`);
    }

    return tokens;
  }

  private _updateState(
    tokens: Token[],
    data: string,
    state: State,
    token: Token
  ) {
    const new_data = data.substring(token.raw.length);
    state.line += token.raw.match("\n")?.length ?? 0;
    tokens.push(token);
    return new_data;
  }
}
