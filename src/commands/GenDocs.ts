import vscode from "vscode";
import { eventEmitter } from "../events/eventEmitter";
import { loggingProvider } from "../providers/loggingProvider";
import { AIProvider } from "../service/base";
import {
	extractCsharpDocs,
	extractJsDocs,
	extractStringDocs,
} from "../service/extractFromCodeMd";
import { generateDocPrompFactory } from "../service/generateDocPrompFactory";
import { isTsRelated } from "../service/langCheckers";
import { isArrowFunction } from "../providers/utilities";

export class GenDocs implements vscode.CodeActionProvider {
	constructor(private readonly _aiProvider: AIProvider) {}

	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Selection | vscode.Range
	): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
		// only provide code actions for the languages that we support
		if (
			!isTsRelated(document.languageId) &&
			document.languageId !== "python" &&
			document.languageId !== "csharp"
		) {
			return;
		}

		if (!("genCodeDocs" in this._aiProvider)) {
			return;
		}
		const codeAction = new vscode.CodeAction(
			"✈️ Document using SAATHI-AI",
			vscode.CodeActionKind.QuickFix
		);
		codeAction.command = {
			command: GenDocs.command,
			title: "✈️ Document using SAATHI-AI",
			arguments: [
				document,
				this._aiProvider,
				vscode.window.activeTextEditor,
			],
		};
		return [codeAction];
	}

	public static readonly command = "wingmanai.gendocument";

	static generateDocs(
		document: vscode.TextDocument,
		aiProvider: AIProvider,
		editor: vscode.TextEditor
	) {
		if (!editor) {
			return;
		}
		const position = editor.selection.active; // Get the position of the cursor
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Window,
				title: "Generating docs...",
			},
			async (process, token) => {
				const symbols = await vscode.commands.executeCommand<
					vscode.DocumentSymbol[]
				>("vscode.executeDocumentSymbolProvider", document.uri);
				if (!symbols) {
					return;
				}

				const abort = new AbortController();
				if (editor) {
					await GenDocs.findMethod(
						symbols,
						editor,
						position,
						abort.signal,
						aiProvider
					);
				}
			}
		);
	}

	static async findMethod(
		symbols: vscode.DocumentSymbol[],
		editor: vscode.TextEditor,
		position: vscode.Position,
		signal: AbortSignal,
		provider: AIProvider
	): Promise<boolean> {
		for (const symbol of symbols) {
			if (signal.aborted) {
				return false;
			}
			if (
				symbol.kind === vscode.SymbolKind.Class &&
				symbol.range.contains(position)
			) {
				await GenDocs.findMethod(
					symbol.children,
					editor,
					position,
					signal,
					provider
				);
				return false;
			} else if (
				(symbol.kind === vscode.SymbolKind.Method ||
					symbol.kind === vscode.SymbolKind.Function ||
					isArrowFunction(symbol, editor.document)) &&
				symbol.range.contains(position)
			) {
				const text = editor.document.getText(symbol.range);

				if (text && "genCodeDocs" in provider) {
					eventEmitter._onQueryStart.fire();
					const result = await provider.genCodeDocs!(
						text,
						generateDocPrompFactory(editor.document.languageId),
						signal
					);
					eventEmitter._onQueryComplete.fire();
					let code = result; //extractFromCodeMd(result); sometimes I'm not getting the full MD so we'll depend on code blocks
					if (!code) {
						loggingProvider.logError(result);
						vscode.window.showErrorMessage(
							"Failed to generate docs"
						);
						return false;
					}
					if (
						editor.document.languageId === "python" &&
						code.length
					) {
						GenDocs.genPythonDocs(editor, symbol, code);
					} else if (isTsRelated(editor.document.languageId)) {
						GenDocs.genJsDocs(editor, symbol, code);
					} else if (editor.document.languageId === "csharp") {
						GenDocs.genCSharpDocs(editor, symbol, code);
					}
				}
				return false;
			}
		}
		return true;
	}

	static genPythonDocs(
		editor: vscode.TextEditor,
		symbol: vscode.DocumentSymbol,
		code: string
	) {
		const text = editor.document.getText(symbol.range);
		const signatureEnd = text.indexOf("\n");
		const signatureEndPosition = symbol.range.start.translate(
			0,
			signatureEnd
		);
		const firstLine = editor.document.lineAt(symbol.range.start.line).text;
		const docs = extractStringDocs(code);
		// get all the whitespaces for the first line
		const spaceMatch = firstLine.match(/^\s*/gm);
		if (spaceMatch?.length && docs.length) {
			const leadingWhitespace = spaceMatch[0] + spaceMatch[0];
			// Remove existing indentation from the comment
			const unindentedDocs = docs.replace(/^\s+/gm, "");
			// Prepend the leading whitespace to each line of the comment
			const indentedDocs = unindentedDocs
				.split("\n")
				.map((line) => leadingWhitespace + line)
				.join("\n");
			editor.edit((editBuilder) => {
				editBuilder.insert(signatureEndPosition, `\n${indentedDocs}`);
			});
		}
	}

	static genJsDocs(
		editor: vscode.TextEditor,
		symbol: vscode.DocumentSymbol,
		code: string
	) {
		// get the space of the first line
		const firstLine = editor.document.lineAt(symbol.range.start.line).text;
		const spaceMatch = firstLine.match(/^\s*/gm);
		const docs = extractJsDocs(code) + "\n";
		if (spaceMatch?.length && docs.length) {
			const leadingWhitespace = spaceMatch[0];
			// need to remove all spaces and tabs from the start of the comment
			const unindentedDocs = docs.replace(/^\s+/gm, "");
			const indentedDocs = unindentedDocs
				.split("\n")
				.map((line) => leadingWhitespace + line)
				.join("\n");
			editor.edit((editBuilder) => {
				editBuilder.insert(
					symbol.range.start,
					indentedDocs.trimStart()
				);
			});
		}
	}

	static genCSharpDocs(
		editor: vscode.TextEditor,
		symbol: vscode.DocumentSymbol,
		code: string
	) {
		const docs = extractCsharpDocs(code);
		const firstLine = editor.document.lineAt(symbol.range.start.line).text;
		const spaceMatch = firstLine.match(/^\s*/gm);
		if (spaceMatch?.length && docs.length) {
			const leading = spaceMatch[0];
			const unindentedDocs = docs.replace(/^\s+/gm, "");
			const indentedDocs = unindentedDocs
				.split("\n")
				.map((line) => leading + line)
				.join("\n");
			editor.edit((editBuilder) => {
				editBuilder.insert(
					symbol.range.start,
					indentedDocs.trimStart() + "\n" + spaceMatch[0]
				);
			});
		}
	}
}
