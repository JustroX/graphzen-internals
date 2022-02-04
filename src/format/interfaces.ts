export interface Task {
  id: string;
  type: `BASIC` | `PARENT` | `FOREIGN`;
  sequence_type: "ORDERED" | "UNORDERED";
  progress_type: `UNIVERSAL` | `EXISTENSIAL`;
  label: string;
  children: Task[];
  attrs: {
    [attribute: string]: string;
  };
}

export interface Progress {
  [task_id: string]: {
    value: any;
    alias: string; // readable alias of the signer
    signer: string; // pubkey of the signer
    date: number; // timestamp
    signed_version: string; // version of the checklist

    sign: string; // MAC
  }[]; //dictionary of signatures
}

export interface Checklist {
  id: string; // id of the checklist
  version: string; // version of the checklist
  creator: string; // public key of the owner
  last_modified: number; // timestamp of last modified
  sign: string; // checklist MAC signed by the creator

  metadata: {
    owner: string; // public key of the checklist owner
    name: string; // name of checklist
    blacklist: {
      key: string; // public key of blacklist
      since: string; // checklist version when key is added to blacklist;
    }[];
    [key: string]: any; // additional metadata
  };

  tasks: Task[]; // list of tasks
  progress: Progress; // current progress of checklist
}
