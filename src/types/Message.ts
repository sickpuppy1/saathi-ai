export interface AppMessage {
	command: string;
	value: unknown;
}

export interface ChatMessage {
	from: "assistant" | "user";
	message: string;
	loading?: boolean;
	context: CodeContext | undefined;
}

export interface CodeContextDetails {
	lineRange: string;
	fileName: string;
	workspaceName: string;
	language: string;
	currentLine: string;
	text: string;
}

export interface CodeContext
	extends Pick<
		CodeContextDetails,
		"fileName" | "lineRange" | "workspaceName"
	> {}
