import { styleText } from "node:util";
import { isAIMessage, isToolMessage } from "@langchain/core/messages";
import { createFinancialAgent, SYSTEM_PROMPT } from "./agent.ts";

const userPrompt =
	process.argv[2] ??
	"Load the top 10 financial planning entries and summarize them by company code.";

console.log(styleText("cyan", `\nPrompt: ${userPrompt}\n`));

const agent = createFinancialAgent();

const stream = await agent.stream(
	{
		messages: [
			{ role: "system", content: SYSTEM_PROMPT },
			{ role: "user", content: userPrompt },
		],
	},
	{ streamMode: "values" },
);

let finalContent = "";

for await (const chunk of stream) {
	const messages = (chunk as any).messages as any[];
	const last = messages[messages.length - 1];

	if (isAIMessage(last)) {
		const toolCalls = last.tool_calls ?? [];
		for (const tc of toolCalls) {
			console.log(
				styleText("yellow", `[tool] ${tc.name}`) +
					" " +
					styleText("dim", JSON.stringify(tc.args)),
			);
		}
		if (!toolCalls.length && last.content) {
			finalContent =
				typeof last.content === "string"
					? last.content
					: JSON.stringify(last.content);
		}
	} else if (isToolMessage(last)) {
		const text =
			typeof last.content === "string"
				? last.content
				: Array.isArray(last.content)
					? last.content.map((c: any) => c.text ?? JSON.stringify(c)).join(" ")
					: JSON.stringify(last.content);
		const preview = text.slice(0, 120);
		console.log(
			styleText("green", `[result] `) +
				styleText("dim", preview + (text.length > 120 ? "…" : "")),
		);
	}
}

console.log("\n" + styleText("bold", finalContent));
