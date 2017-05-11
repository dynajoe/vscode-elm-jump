'use strict';
import * as vscode from 'vscode'
import * as _ from 'lodash'
import * as Parser from './parse'

const ELM_MODE: vscode.DocumentFilter = { language: 'elm', scheme: 'file' }

interface ElmFile {
    file_uri: vscode.Uri
    text: string
}

export async function loadElmDocuments(): Promise<vscode.TextDocument[]> {
    const path_to_search = `**/*.elm`

    const elm_files = await vscode.workspace.findFiles(path_to_search, '**/node_modules/**')

    return await Promise.all(elm_files.map(x => vscode.workspace.openTextDocument(x)))
}

interface ExposedType {
    name: string
    position: vscode.Position
}

function extractExposedTypes(parse_result: Parser.ElmParseResult): ExposedType[] {
    if (!parse_result.status) {
        return []
    }

    return parse_result.value
        .filter(x => x.kind === 'type' || x.kind === 'type_alias')
        .map<ExposedType>((x: Parser.NamedStatement) => ({
            name: x.name,
            position: new vscode.Position(x.position.line, 0),
        }))
}

export class ElmGoToProvider implements vscode.DefinitionProvider {
    public async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location> {

        const elm_documents = await loadElmDocuments()

        const parsed_files = elm_documents.map(x => {
            return {
                parse_result: Parser.parse(x.getText()),
                document: x,
            }
        })

        const elm_file_details = parsed_files
            .filter(x => x.parse_result.status)
            .map(x => {
                try {
                    const module_declaration = <Parser.NamedStatement> _.find(x.parse_result.value, x => x.kind === 'module')
                const imports = <Parser.ImportStatement[]> _.filter(x.parse_result.value, x => x.kind === 'import')
                const exposed_types = extractExposedTypes(x.parse_result)

                return {
                    module_name: module_declaration.name,
                    imports: imports,
                    exposed_types: exposed_types,
                    parsed: x.parse_result.value,
                    document: x.document,
                }
            }
            catch(e){
                return null
            }

            })

        const files_by_module_name = _.keyBy(elm_file_details, x => x.module_name)

        const dependency_graph = _(elm_file_details)
            .map(x => {
                return {
                    uri: x.document.uri,
                    subject: x,
                    dependencies: _.compact(x.imports.map(i => files_by_module_name[i.module]))
                }
            })
            .keyBy(x => x.uri.fsPath)
            .value()

        const my_node = dependency_graph[document.uri.fsPath]

        const selected_symbol = document.getText(document.getWordRangeAtPosition(position))

        const lookup_nodes = [my_node.subject].concat(my_node.dependencies)

        const matching_node = _.find(lookup_nodes, x => _.find(x.exposed_types, t => t.name === selected_symbol))

        if (_.isNil(matching_node)) {
            return null
        } else {
            const jump_to_position = matching_node.exposed_types.find(x => x.name === selected_symbol).position

            return new vscode.Location(matching_node.document.uri, jump_to_position)
        }

    }
}

export async function activate(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(vscode.languages.registerDefinitionProvider(ELM_MODE, new ElmGoToProvider()))
}