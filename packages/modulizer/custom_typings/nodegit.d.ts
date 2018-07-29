declare module 'nodegit' {
  export class Signature { static now(name: string, email: string): Signature; }
  export class Cred {
    static userpassPlaintextNew(value: string, kind: string): Cred;
    static sshKeyFromAgent(username: string): Cred;
  }
  export class Branch {
    static create(
        repo: Repository, branchName: string, commit: Commit,
        force: boolean): Promise<Reference>;
  }

  interface CertificateCheckCallback {
    (): Number;
  }

  interface CredentialsCallback {
    (url: string, userName: string): Cred;
  }

  export class FetchCallbacks {
    certificateCheck: CertificateCheckCallback;
    credentials: CredentialsCallback;
  }

  export class FetchOptions { callbacks: FetchCallbacks; }
  class CloneOptions {
    fetchOpts: FetchOptions;
  }
  export class Clone {
    static clone(url: string, local_path: string, options?: CloneOptions):
        Promise<Repository>;
  }
  export class Repository {
    static open(path: string): Promise<Repository>;
    createCommitOnHead(
        filesToAdd: string[], author: Signature, committer: Signature,
        message: string): Promise<Oid>;
    getHeadCommit(): Promise<Commit>;
    setHead(refname: string): Promise<Number>;
    getBranch(refname: string): Promise<Reference>;
    getBranchCommit(branch: string): Promise<Commit>;
    checkoutBranch(branch: string|Reference): Promise<void>;
    getRemote(remote: string): Promise<Remote>;
    fetch(remote: string, fetchOpts: FetchOptions): Promise<void>;
    fetchAll(fetchOpts: FetchOptions): Promise<void>;
    defaultSignature(): Signature;
    setHeadDetached(commitish: Oid, a: any, b: any): Number;
    getReferenceCommit(name: string|Reference): Promise<Commit>;
    checkoutRef(ref: Reference): Promise<void>;
    path(): string;
    workdir(): string;
  }
  interface RemoteCallbacks {
    credentials?: () => Cred;
  }
  interface PushOptions {
    callbacks?: RemoteCallbacks;
    pbParallelism?: number;
    version?: number;
  }
  export class Remote {
    push(refSpecs: string[], options: PushOptions): Promise<number>;
  }
  export class Oid {}
  export class Tree {}
  export class Commit { id(): string; }
  export class Reference { static list(repo: Repository): Promise<any>; }

  export class Tag {
    static list(repo: Repository): Promise<string[]>;
    static lookup(repo: Repository, id: string|Oid|Tag): Tag;
    targetId(): Oid;
  }

  type TreeIsh = Oid|Tree|Commit|Reference;

  export interface CheckoutOptions { checkoutStrategy: Number; }

  interface Strategies {
    FORCE: Number;
  }

  export class Checkout {
    static STRATEGY: Strategies;
    static tree(repo: Repository, treeIsh: TreeIsh): Promise<void>;
    static head(repo: Repository, options?: CheckoutOptions): Promise<void>;
  }
}
