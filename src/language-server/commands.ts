/**
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {ApplyWorkspaceEditParams, ApplyWorkspaceEditRequest, ApplyWorkspaceEditResponse, IConnection, WorkspaceEdit} from 'vscode-languageserver';

import DiagnosticGenerator from './diagnostics';
import {Handler} from './util';

export const applyEditCommandName = 'polymer-ide/applyEdit';

export const applyAllFixesCommandName = 'polymer-ide/applyAllFixes';

export const allSupportedCommands =
    [applyEditCommandName, applyAllFixesCommandName];

export default class CommandExecutor extends Handler {
  constructor(
      protected connection: IConnection,
      private diagnosticGenerator: DiagnosticGenerator) {
    super();
    connection.onExecuteCommand(async(req) => {
      if (req.command === applyEditCommandName) {
        return this.handleErrors(
            this.executeApplyEditCommand(req.arguments as [WorkspaceEdit]),
            undefined);
      }
      if (req.command === applyAllFixesCommandName) {
        return this.handleErrors(this.executeApplyAllFixesCommand(), undefined);
      }
    });
  }

  private async executeApplyEditCommand(args: [WorkspaceEdit]) {
    await this.applyEdits(args[0]);
  }

  private async executeApplyAllFixesCommand() {
    const workspaceEdit = await this.diagnosticGenerator.getAllFixes();
    await this.applyEdits(workspaceEdit);
  }

  private async applyEdits(workspaceEdit: WorkspaceEdit) {
    const params: ApplyWorkspaceEditParams = {edit: workspaceEdit};
    return (await this.connection.sendRequest(
        ApplyWorkspaceEditRequest.type.method,
        params)) as ApplyWorkspaceEditResponse;
  }
}
