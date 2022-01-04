import { Identity } from "./identity";

export type Version = `${number}.${number}.${number}`;

export enum TaskType {
  BASIC = "BASIC",
  FOREIGN = "FOREIGN",
  PARENT_UNVERSAL = "PARENT-UNVERSAL",
  PARENT_EXISTENTIAL = "PARENT-EXISTENTIAL",
}

export enum Component {
  CONTENT = "CONTENT",
  PROGRESS = "PROGRESS",
}

export interface Task {
  id: string;
  type: TaskType;
  label: string;
  children: Task[];
  attrs: {
    [attribute: string]: string;
  };
}

export interface Progress {
  [taskID: string]: {
    value: any;
    alias: string;
    signer: string;
    sign: string;
    date: number;
    signed_version: string;
  }[];
}

export interface ChecklistData {
  id: string;
  version: string;
  tasks: Task[];
  progress: Progress;

  metadata: {
    owner: string;
    name: string;
    blacklist: {
      key: string;
      since: string;
    }[];
    [meta: string]: any;
  };

  creator: string;
  sign: string;
}

export class Checklist {
  public is_edit_mode: boolean = false;
  public snapshot: string = "";

  private constructor(public data: ChecklistData) {}

  static fromFile(path: string): Checklist {
    throw new Error("Not yet implemented.");
  }

  static fromText(text: string): Checklist {
    throw new Error("Not yet implemented.");
  }

  static create(
    name: string,
    identity: Identity,
    version: Version = "0.0.0"
  ): Checklist {
    throw new Error("Not yet implemented.");
  }

  saveFile(
    path: string,
    components: Component[] = [Component.CONTENT, Component.PROGRESS]
  ) {
    throw new Error("Not yet implemented.");
  }
  saveText(
    components: Component[] = [Component.CONTENT, Component.PROGRESS]
  ): string {
    throw new Error("Not yet implemented.");
  }

  verify(): boolean {
    throw new Error("Not yet implemented.");
  }

  commit(identity: Identity, version?: Version) {
    throw new Error("Not yet implemented.");
  }

  reject() {
    throw new Error("Not yet implemented.");
  }
}
