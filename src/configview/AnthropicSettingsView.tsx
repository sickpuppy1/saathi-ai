import { ApiSettingsType } from "../types/Settings";
import { InitSettings } from "./App";
import { Container, VSCodeTextField } from "./Config.styles";

type AnthropicSection = InitSettings["anthropic"] & {
	onChange: (anthropicSettings: ApiSettingsType) => void;
};
export const AnthropicSettingsView = ({
	codeModel,
	chatModel,
	baseUrl,
	apiKey,
	onChange,
}: AnthropicSection) => {
	const paths = { codeModel, chatModel, baseUrl, apiKey };
	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-ignore
		clone[field] = e.target.value;
		onChange(clone);
	};

	return (
		<Container>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={codeModel}
				data-name="codeModel"
				title="Anthropic Code Model"
			>
				Code Model:
			</VSCodeTextField>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={chatModel}
				data-name="chatModel"
				title="Anthropic Chat Model"
			>
				Chat Model:
			</VSCodeTextField>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={baseUrl}
				data-name="baseUrl"
				title="Anthropic base url"
			>
				Base url:
			</VSCodeTextField>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={apiKey}
				data-name="apiKey"
				title="Anthropic api key"
			>
				Api key:
			</VSCodeTextField>
		</Container>
	);
};
