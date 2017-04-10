/* --------------------------------------------------------------------------------------------
 * Copyright multiple authors.
 * See ../LICENSE for license information.
 ------------------------------------------------------------------------------------------
 */

/**
 * Implements the [language server protocol][1] v3.0 for Web Components and
 * Polymer.
 *
 * Communicates over stdin/stdout.
 *
 * [1]: https://github.com/Microsoft/language-server-protocol
 */

// This import *must* come first.
import logInterceptor = require('./intercept-logs');
//



import * as path from 'path';
import {Severity, WarningCarryingException, SourceRange, FSUrlLoader, PackageUrlResolver, SourcePosition, Warning} from 'polymer-analyzer';
import {CompletionItem, CompletionItemKind, CompletionList, createConnection, Definition, Diagnostic, DiagnosticSeverity, Hover, IConnection, InitializeResult, Location, Position as LSPosition, Range, TextDocument, TextDocumentPositionParams, TextDocuments} from 'vscode-languageserver';
import Uri from 'vscode-uri';

import {EditorService, TypeaheadCompletion, AttributeCompletion} from './editor-service';

import {LocalEditorService} from './local-editor-service';


interface SettingsWrapper {
  polymerVscodePlugin: Settings;
}

// The settings defined in the client's package.json file.
interface Settings {}

// Create a connection for the server. Communicate using stdio.
let connection: IConnection = createConnection(process.stdin, process.stdout);

// The settings have changed. Is sent on server activation as well.
connection.onDidChangeConfiguration((change) => {
  let settings = <SettingsWrapper>change.settings;
  // TODO(rictic): use settings for real
  settings.polymerVscodePlugin;
});

let editorService: EditorService|null = null;

// Create a simple text document manager. The text document manager
// supports full document sync only
// TODO(rictic): for speed, sync diffs instead.
let documents: TextDocuments = new TextDocuments();

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);


// After the server has started the client sends an initilize request. The
// server receives in the passed params the rootPath of the workspace plus the
// client capabilites.
let workspaceUri: Uri|null = null;

function getWorkspaceUri(
    rootUri: string|null, rootPath: string|null|undefined): Uri|null {
  if (rootUri) {
    return Uri.parse(rootUri);
  }
  if (rootPath) {
    return Uri.file(rootPath);
  }
  return null;
}

connection.onInitialize((params): InitializeResult => {
  let maybeWorkspaceUri = getWorkspaceUri(params.rootUri, params.rootPath);
  // Leave workspaceUri unset if we're initialized in a way we can't handle.
  if (!maybeWorkspaceUri || maybeWorkspaceUri.scheme !== 'file') {
    return {capabilities: {}};
  }
  workspaceUri = maybeWorkspaceUri;
  const workspacePath = workspaceUri.fsPath;
  const polymerJsonPath = path.join(workspacePath, 'polymer.json');
  editorService = new LocalEditorService({
    urlLoader: new FSUrlLoader(workspacePath),
    urlResolver: new PackageUrlResolver(), polymerJsonPath
  });
  mapAllInitialDocuments(editorService);

  // The console will be valid immediately after the connection has initialized.
  // So hook it up then.
  Promise.resolve(() => {
    logInterceptor.hookUpRemoteConsole(connection.console);
  });
  return {
    capabilities: {
      // Tell the client that the server works in FULL text document sync mode
      textDocumentSync: documents.syncKind,
      // Tell the client that the server support code complete
      completionProvider: {resolveProvider: false},
      hoverProvider: true,
      definitionProvider: true,
    }
  };
});

async function mapAllInitialDocuments(editorService: EditorService) {
  for (const document of documents.all()) {
    const localPath = getWorkspacePathToFile(document);
    if (localPath) {
      await editorService.fileChanged(localPath, document.getText());
    }
  }
  await reportErrors(editorService, connection);
}

// The content of a text document has changed. This event is emitted
// when the text document is first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  return handleErrors(handleChangedDocument(change.document), undefined);
});

async function handleChangedDocument(document: TextDocument) {
  if (editorService) {
    const localPath = getWorkspacePathToFile(document);
    if (localPath) {
      await editorService.fileChanged(localPath, document.getText());
    }
    await reportErrors(editorService, connection);
  }
}

async function reportErrors(
    editorService: EditorService, connection: IConnection) {
  for (const document of documents.all()) {
    const localPath = getWorkspacePathToFile(document);
    if (!localPath) {
      continue;
    }
    const warnings = await editorService.getWarningsForFile(localPath);
    connection.sendDiagnostics({
      diagnostics: warnings.map(convertWarningToDiagnostic),
      uri: document.uri
    });
  }
}

connection.onHover(async(textPosition) => {
  return handleErrors(getDocsForHover(textPosition), undefined);
});

async function getDocsForHover(textPosition: TextDocumentPositionParams):
    Promise<Hover|undefined> {
      const localPath = getWorkspacePathToFile(textPosition.textDocument);
      if (localPath && editorService) {
        const documentation = await editorService.getDocumentationAtPosition(
            localPath, convertPosition(textPosition.position));
        if (documentation) {
          return {contents: documentation};
        }
      }
    }

connection.onDefinition(async(textPosition) => {
  return handleErrors(getDefinition(textPosition), undefined);
});

async function getDefinition(textPosition: TextDocumentPositionParams):
    Promise<Definition|undefined> {
      const localPath = getWorkspacePathToFile(textPosition.textDocument);
      if (localPath && editorService) {
        const location = await editorService.getDefinitionForFeatureAtPosition(
            localPath, convertPosition(textPosition.position));
        if (location && location.file) {
          let definition: Location = {
            uri: getUriForLocalPath(location.file),
            range: convertRange(location)
          };
          return definition;
        }
      }
    }

// This handler provides the initial list of the completion items.
connection.onCompletion(async(textPosition) => {
  return handleErrors(
      autoComplete(textPosition), {isIncomplete: true, items: []});
});

async function autoComplete(
    textPosition: TextDocumentPositionParams): Promise<CompletionList> {
  const localPath = getWorkspacePathToFile(textPosition.textDocument);
  if (!localPath || !editorService) {
    return {isIncomplete: true, items: []};
  }
  const completions: (TypeaheadCompletion|undefined) =
      await editorService.getTypeaheadCompletionsAtPosition(
          localPath, convertPosition(textPosition.position));
  if (!completions) {
    return {isIncomplete: false, items: []};
  }
  if (completions.kind === 'element-tags') {
    return {
      isIncomplete: false,
      items: completions.elements.map(c => {
        return <CompletionItem>{
          label: `<${c.tagname}>`,
          kind: CompletionItemKind.Class,
          documentation: c.description,
          insertText: c.expandTo
        };
      }),
    };
  } else if (completions.kind === 'attributes') {
    return {
      isIncomplete: false,
      items: completions.attributes.map(attributeCompletionToCompletionItem),
    };
  } else if (completions.kind === 'properties-in-polymer-databinding') {
    return {
      isIncomplete: false,
      items: completions.properties.map(attributeCompletionToCompletionItem)
    };
  }
  return {isIncomplete: false, items: []};
};

function attributeCompletionToCompletionItem(
    attrCompletion: AttributeCompletion) {
  const item: CompletionItem = {
    label: attrCompletion.name,
    kind: CompletionItemKind.Field,
    documentation: attrCompletion.description,
    sortText: attrCompletion.sortKey
  };
  if (attrCompletion.type) {
    item.detail = `{${attrCompletion.type}}`;
  }
  if (attrCompletion.inheritedFrom) {
    if (item.detail) {
      item.detail = `${item.detail} ⊃ ${attrCompletion.inheritedFrom}`;
    } else {
      item.detail = `⊃ ${attrCompletion.inheritedFrom}`;
    }
  }
  return item;
}

function getWorkspacePathToFile(doc: {uri: string}): string|undefined {
  if (!workspaceUri) {
    return undefined;
  }
  return path.relative(workspaceUri.fsPath, Uri.parse(doc.uri).fsPath);
}

function getUriForLocalPath(localPath: string): string {
  if (!workspaceUri) {
    throw new Error(`Tried to get the URI of ${localPath
                    } without knowing the workspaceUri!?`);
  }
  const workspacePath = workspaceUri.fsPath;
  const absolutePath = path.join(workspacePath, localPath);
  return Uri.file(absolutePath).toString();
}

function convertPosition(position: LSPosition): SourcePosition {
  return {line: position.line, column: position.character};
}

function convertRange(range: SourceRange): Range {
  return {
    start: {line: range.start.line, character: range.start.column},
    end: {line: range.end.line, character: range.end.column}
  };
}

function convertSeverity(severity: Severity): DiagnosticSeverity {
  switch (severity) {
    case Severity.ERROR:
      return DiagnosticSeverity.Error;
    case Severity.WARNING:
      return DiagnosticSeverity.Warning;
    case Severity.INFO:
      return DiagnosticSeverity.Information;
    default:
      throw new Error(
          `This should never happen. Got a severity of ${severity}`);
  }
}


function convertWarningToDiagnostic(warning: Warning): Diagnostic {
  return {
    code: warning.code,
    message: warning.message,
    range: convertRange(warning.sourceRange),
    source: 'polymer-ide',
    severity: convertSeverity(warning.severity),
  };
}

connection.onDidCloseTextDocument(({textDocument}) => {
  connection.sendDiagnostics({diagnostics: [], uri: textDocument.uri});
});

async function handleErrors<Result, Fallback>(
    promise: Promise<Result>,
    fallbackValue: Fallback): Promise<Result|Fallback> {
  try {
    return await promise;
  } catch (err) {
    // Ignore WarningCarryingExceptions, they're expected, and made visible
    //   to the user in a useful way. All other exceptions should be logged
    //   if possible.
    if (connection && !(err instanceof WarningCarryingException)) {
      connection.console.warn(err.stack || err.message || err);
    }
    return fallbackValue;
  }
}


// Listen on the connection
connection.listen();
