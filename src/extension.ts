'use strict';
import * as vscode from 'vscode'
import * as _ from 'lodash'

const ELM_MODE: vscode.DocumentFilter = { language: 'elm', scheme: 'file' }

export async function findElmFiles(): Promise<vscode.Uri[]> {
    const path_to_search = `**/*.elm`

    return await vscode.workspace.findFiles(path_to_search, '**/node_modules/**')
}

interface TypeDefinition {
    name: string
    position: vscode.Position
    file_uri: vscode.Uri
}

async function extractExposedTypes(elm_file: vscode.Uri): Promise<TypeDefinition[]> {
    const text_document = await vscode.workspace.openTextDocument(elm_file)

    const elm_file_lines = text_document.getText().split('\n')

    const type_declaration_lines = elm_file_lines
        .map((l, i) => ({ line_number: i, text: l, matches: l.match(/^type( alias)? (\w+)/) }))
        .filter(x => x.matches)
        .map<TypeDefinition>(x => ({
            name: x.matches[2],
            position: new vscode.Position(x.line_number, 0),
            file_uri: elm_file,
        }))

    return Promise.resolve(type_declaration_lines)
}

export class ElmGoToProvider implements vscode.DefinitionProvider {
    public async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location> {

        const elm_files = await findElmFiles()

        const exposed_types = await Promise.all(elm_files.map(extractExposedTypes))

        const files_with_types = exposed_types.filter(x => x.length > 0)

        const all_type_definitions = _(files_with_types)
            .flatMap(x => x)
            .keyBy(x => x.name)
            .value()

        const selected_text = document.getText(document.getWordRangeAtPosition(position))

        if (!all_type_definitions[selected_text]) {
            return null
        } else {
            return new vscode.Location(all_type_definitions[selected_text].file_uri, all_type_definitions[selected_text].position)
        }

    }
}

export async function activate(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELM_MODE, new ElmGoToProvider()))
}