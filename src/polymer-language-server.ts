/* --------------------------------------------------------------------------------------------
 * Copyright multiple authors.
 * See ../LICENSE for license information.
 ------------------------------------------------------------------------------------------
 */

/**
 * Implements the [language server protocol][1] v2.0 for Web Components and
 * Polymer.
 *
 * Communicates over stdin/stdout.
 *
 * [1]: https://github.com/Microsoft/language-server-protocol
 */

import * as path from 'path';

import {CompletionList, Location, Range, createConnection, IConnection, TextDocuments, TextDocument, Diagnostic, DiagnosticSeverity, InitializeResult, TextDocumentPositionParams, CompletionItem, CompletionItemKind, Position as LSPosition, Hover, Definition} from 'vscode-languageserver';
import {FSUrlLoader} from 'polymer-analyzer/lib/url-loader/fs-url-loader';
import {PackageUrlResolver} from 'polymer-analyzer/lib/url-loader/package-url-resolver';
import {Severity, WarningCarryingException} from 'polymer-analyzer/lib/warning/warning';

import {LocalEditorService} from 'polymer-analyzer/lib/editor-service/local-editor-service';
import {EditorService, SourcePosition, TypeaheadCompletion} from 'polymer-analyzer/lib/editor-service/editor-service';

import {SourceRange} from 'polymer-analyzer/lib/model/model';

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
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
  workspaceRoot = params.rootPath;
  editorService = new LocalEditorService({
    urlLoader: new FSUrlLoader(workspaceRoot),
    urlResolver: new PackageUrlResolver()
  });
  documents.all().forEach(d => scanDocument(d));
  return <InitializeResult>{
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

// The content of a text document has changed. This event is emitted
// when the text document is first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  scanDocument(change.document, connection);
});


connection.onHover(async(textPosition) => {
  return handleErrors(getDocsForHover(textPosition), undefined);
});

async function getDocsForHover(textPosition: TextDocumentPositionParams): Promise<Hover|undefined> {
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

async function getDefinition(textPosition: TextDocumentPositionParams): Promise<Definition|undefined> {
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
  return handleErrors(autoComplete(textPosition), {isIncomplete: true, items: []});
});

async function autoComplete(textPosition: TextDocumentPositionParams):
    Promise<CompletionList> {
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
      items: completions.attributes.map(a => {
        const item: CompletionItem = {
          label: a.name,
          kind: CompletionItemKind.Field,
          documentation: a.description,
          sortText: a.sortKey
        };
        if (a.type) {
          item.detail = `{${a.type}}`;
        }
        if (a.inheritedFrom) {
          if (item.detail) {
            item.detail = `${item.detail} ⊃ ${a.inheritedFrom}`;
          } else {
            item.detail = `⊃ ${a.inheritedFrom}`;
          }
        }
        return item;
      }),
    };
  }
  return {isIncomplete: false, items: []};
}

function getWorkspacePathToFile(doc: {uri: string}): string|undefined {
  // We only support file urls. Extract everything after file:///
  // Note the third slash. We pull that out too. See the absolute path
  // generation code below.
  const match = doc.uri.match(/^file:\/\/\/?(.*)/);
  if (!match || !match[1] || !workspaceRoot) {
    return undefined;
  }
  // Decode the URI encoding. TODO: something something unicode?
  const decodedPath = decodeURIComponent(match[1]);
  // We've stripped off the leading `/`, which on unix means that we have a
  // relative-looking path, but on Windows we still have an absolute path that
  // starts with e.g. `C:\`. We can normalize these two by forcing both into
  // an absolute path, like so:
  const absolutePath = path.resolve('/', decodedPath);
  // But what the editor service really wants is a path relative to the
  // workspace root. So do that.
  return path.relative(workspaceRoot, absolutePath);
}

function getUriForLocalPath(localPath: string): string {
  return `file://${workspaceRoot}/${localPath}`;
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

function scanDocument(document: TextDocument, connection?: IConnection) {
  return handleErrors(_scanDocument(document, connection), undefined);
}

async function _scanDocument(document: TextDocument, connection?: IConnection) {
  if (editorService) {
    const localPath = getWorkspacePathToFile(document);
    if (!localPath) {
      return;
    }
    editorService.fileChanged(localPath, document.getText());

    if (connection) {
      const diagnostics: Diagnostic[] = [];
      const warnings = await editorService.getWarningsForFile(localPath);
      for (const warning of warnings) {
        diagnostics.push({
          code: warning.code,
          message: warning.message,
          range: convertRange(warning.sourceRange),
          source: 'polymer-ide',
          severity: convertSeverity(warning.severity),
        });
      }
      connection.sendDiagnostics({diagnostics, uri: document.uri});
    }
  }
}

async function handleErrors<Result, Fallback>(promise: Promise<Result>, fallbackValue: Fallback):
    Promise<Result|Fallback> {
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
