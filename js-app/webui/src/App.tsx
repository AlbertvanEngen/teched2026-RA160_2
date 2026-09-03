import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message, ToolEntry, TurnGroup } from './types.ts';

marked.setOptions({ gfm: true, breaks: true });

function parseMarkdown(md: string): DocumentFragment {
	const result = marked.parse(md);
	return DOMPurify.sanitize(typeof result === 'string' ? result : '', {
		RETURN_DOM_FRAGMENT: true,
		USE_PROFILES: { html: true },
	});
}

const SAMPLE_QUERIES = [
	'Show me the quarterly budget for cost center A1000 for the last 12 months.',
	'Show me the monthly cost for cost center A1000 for the last 12 months.',
	'Forecast: plan the budget for cost center A1000 for the next 12 months based on historical data.',
	'Load journal entries for cost center A1000 as actuals, load budget planning entries as prediction target, then run_rpt_prediction_from_sources to predict amountInGlobalCurrency.',
];

// Human-readable labels for tool names
const TOOL_LABELS: Record<string, string> = {
	query_financial_planning: 'Querying financial planning data',
	query_journal_entry: 'Querying journal entries',
	query_duckdb: 'Running SQL analysis',
	run_rpt_prediction: 'Running RPT prediction',
	run_rpt_prediction_from_sources: 'Running RPT prediction',
	drop_table: 'Cleaning up tables',
	create_view: 'Creating analytical view',
};

function toolLabel(name: string): string {
	return TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
}

const THINKING_PHRASES = [
	'Reticulating splines…',
	'Pondering deeply…',
	'Consulting the oracle…',
	'Crunching numbers…',
	'Doing math…',
	'Asking the database nicely…',
	'Staring at spreadsheets…',
	'Aligning fiscal years…',
	'Reversing the polarity…',
	'Checking the ledger…',
];

function useRotatingPhrase(active: boolean, intervalMs = 2200) {
	const [idx, setIdx] = useState(0);
	useEffect(() => {
		if (!active) return;
		setIdx(Math.floor(Math.random() * THINKING_PHRASES.length));
		const id = setInterval(() => {
			setIdx((i) => (i + 1) % THINKING_PHRASES.length);
		}, intervalMs);
		return () => clearInterval(id);
	}, [active, intervalMs]);
	return THINKING_PHRASES[idx];
}

function ToolEntryCard({ t }: { t: ToolEntry }) {
	const [open, setOpen] = useState(false);
	const isDone = t.result !== undefined;
	const result = t.result ?? '';
	return (
		<div className={`tool-entry${isDone ? '' : ' is-active'}`}>
			<button
				type="button"
				className="tool-entry__row"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
			>
				<span
					className={`tool-entry__status ${isDone ? 'done' : 'pending'}`}
					role="status"
					aria-label={isDone ? 'complete' : 'running'}
				/>
				<span className="tool-entry__name-text">{t.name}</span>
				<span className="tool-entry__chevron">{open ? '▾' : '▸'}</span>
			</button>
			{!open && (
				<div className="tool-entry__preview">
					{Object.entries(t.args)
						.slice(0, 2)
						.map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
						.join('  ')}
				</div>
			)}
			{open && (
				<div className="tool-entry__detail">
					<div className="tool-entry__detail-label">args</div>
					<pre className="tool-entry__detail-pre">
						{JSON.stringify(t.args, null, 2)}
					</pre>
					{isDone && (
						<>
							<div className="tool-entry__detail-label">result</div>
							<pre className="tool-entry__detail-pre">
								{result.slice(0, 600)}
								{result.length > 600 ? '\n…' : ''}
							</pre>
						</>
					)}
				</div>
			)}
		</div>
	);
}

function ToolRail({
	turns,
	activeTurnId,
}: {
	turns: TurnGroup[];
	activeTurnId: string | null;
}) {
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const prevActiveTurnId = useRef<string | null>(null);

	// When a new turn becomes active, collapse the previous one
	useEffect(() => {
		if (
			activeTurnId &&
			prevActiveTurnId.current &&
			activeTurnId !== prevActiveTurnId.current
		) {
			const previousTurnId = prevActiveTurnId.current;
			setCollapsed((prev) => new Set([...prev, previousTurnId]));
		}
		prevActiveTurnId.current = activeTurnId;
	}, [activeTurnId]);

	const toggle = (id: string) =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});

	const reversed = [...turns].reverse();

	return (
		<aside className="tool-rail" aria-label="Agent activity">
			<div className="tool-rail__header">Activity</div>
			<div className="tool-rail__list" role="log" aria-live="polite">
				{turns.length === 0 && (
					<p className="tool-rail__empty">Tool calls appear here</p>
				)}
				{reversed.map((turn) => {
					const isOpen = !collapsed.has(turn.turnId);
					const pending = turn.tools.some((t) => t.result === undefined);
					return (
						<div key={turn.turnId} className="turn-group">
							<button
								type="button"
								className={`turn-group__header${pending ? ' is-pending' : ''}`}
								onClick={() => toggle(turn.turnId)}
								aria-expanded={isOpen}
							>
								<span
									className={`tool-entry__status ${pending ? 'pending' : 'done'}`}
									aria-hidden="true"
								/>
								<span className="turn-group__label">{turn.label}</span>
								<span className="turn-group__count">{turn.tools.length}</span>
								<span className="turn-group__chevron">
									{isOpen ? '▾' : '▸'}
								</span>
							</button>
							{isOpen && (
								<div className="turn-group__body">
									{[...turn.tools].reverse().map((t) => (
										<ToolEntryCard key={t.id} t={t} />
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</aside>
	);
}

function ActivityIndicator({ toolName }: { toolName: string | null }) {
	const phrase = useRotatingPhrase(!toolName);
	const label = toolName ? toolLabel(toolName) : phrase;
	return (
		<div className="msg-row msg-row--assistant">
			<div
				className="msg-bubble msg-bubble--thinking"
				role="status"
				aria-live="polite"
				aria-label="Agent working"
			>
				<span className="thinking-dots" aria-hidden="true">
					<span />
					<span />
					<span />
				</span>
				<span>{label}</span>
			</div>
		</div>
	);
}

function SanitizedMarkdown({ content }: { content: string }) {
	const contentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		contentRef.current?.replaceChildren(parseMarkdown(content));
	}, [content]);

	return <div ref={contentRef} className="msg-bubble msg-bubble--assistant" />;
}

function MessageBubble({ msg }: { msg: Message }) {
	const [thinkingOpen, setThinkingOpen] = useState(false);

	if (msg.role === 'user') {
		return (
			<div className="msg-row msg-row--user">
				<div className="msg-bubble msg-bubble--user">{msg.content}</div>
			</div>
		);
	}
	return (
		<div className="msg-row msg-row--assistant">
			<div className="msg-col">
				{msg.thinking && (
					<button
						type="button"
						className="thinking-toggle"
						onClick={() => setThinkingOpen((o) => !o)}
						aria-expanded={thinkingOpen}
					>
						<span className="thinking-toggle__icon">
							{thinkingOpen ? '▾' : '▸'}
						</span>
						Reasoning
					</button>
				)}
				{msg.thinking && thinkingOpen && (
					<div className="thinking-block">{msg.thinking}</div>
				)}
				<SanitizedMarkdown content={msg.content} />
			</div>
		</div>
	);
}

export default function App() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [turns, setTurns] = useState<TurnGroup[]>([]);
	const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
	const [input, setInput] = useState('');
	const [running, setRunning] = useState(false);
	// null = not running, '' = running but no tool yet, 'tool_name' = specific tool active
	const [activeToolName, setActiveToolName] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const chatRef = useRef<HTMLDivElement>(null);
	const idRef = useRef(0);

	const nextId = useCallback(() => String(++idRef.current), []);

	useEffect(() => {
		if (chatRef.current && (messages.length > 0 || activeToolName !== null)) {
			chatRef.current.scrollTop = chatRef.current.scrollHeight;
		}
	}, [messages.length, activeToolName]);

	const runPrompt = useCallback(
		async (prompt: string) => {
			if (!prompt || running) return;

			setError(null);
			setRunning(true);
			setActiveToolName('');

			setMessages((prev) => [
				...prev,
				{ id: nextId(), role: 'user', content: prompt, toolIds: [] },
			]);

			const turnId = nextId();
			setActiveTurnId(turnId);
			setTurns((prev) => [
				...prev,
				{
					turnId,
					label: prompt.slice(0, 40) + (prompt.length > 40 ? '…' : ''),
					tools: [],
				},
			]);

			let assistantId: string | null = null;

			try {
				const res = await fetch('/api/agent/run', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ prompt }),
				});

				if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let buf = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buf += decoder.decode(value, { stream: true });

					const parts = buf.split('\n\n');
					buf = parts.pop() ?? '';

					for (const part of parts) {
						const eventLine = part.match(/^event: (.+)/m)?.[1];
						const dataLine = part.match(/^data: (.+)/m)?.[1];
						if (!eventLine || !dataLine) continue;

						const payload = JSON.parse(dataLine) as Record<string, unknown>;

						if (eventLine === 'thinking') {
							const text = payload.text as string;
							if (!assistantId) {
								const newAssistantId = nextId();
								assistantId = newAssistantId;
								setActiveToolName(null);
								setMessages((prev) => [
									...prev,
									{
										id: newAssistantId,
										role: 'assistant',
										content: '',
										thinking: text,
										toolIds: [],
									},
								]);
							} else {
								setMessages((prev) =>
									prev.map((m) =>
										m.id === assistantId
											? { ...m, thinking: (m.thinking ?? '') + text }
											: m,
									),
								);
							}
						} else if (eventLine === 'delta') {
							const text = payload.text as string;
							if (!assistantId) {
								const newAssistantId = nextId();
								assistantId = newAssistantId;
								setActiveToolName(null);
								setMessages((prev) => [
									...prev,
									{
										id: newAssistantId,
										role: 'assistant',
										content: text,
										toolIds: [],
									},
								]);
							} else {
								setMessages((prev) =>
									prev.map((m) =>
										m.id === assistantId
											? { ...m, content: m.content + text }
											: m,
									),
								);
							}
						} else if (eventLine === 'tool_call') {
							const entry: ToolEntry = {
								id: payload.id as string,
								name: payload.name as string,
								args: payload.args as Record<string, unknown>,
								startedAt: Date.now(),
							};
							setTurns((prev) =>
								prev.map((t) =>
									t.turnId === turnId
										? { ...t, tools: [...t.tools, entry] }
										: t,
								),
							);
							setActiveToolName(entry.name);
							if (assistantId) {
								setMessages((prev) =>
									prev.map((m) =>
										m.id === assistantId
											? { ...m, toolIds: [...m.toolIds, entry.id] }
											: m,
									),
								);
							}
						} else if (eventLine === 'tool_result') {
							const tid = payload.id as string;
							const result = payload.result as string;
							setTurns((prev) =>
								prev.map((t) =>
									t.turnId === turnId
										? {
												...t,
												tools: t.tools.map((e) =>
													e.id === tid ? { ...e, result } : e,
												),
											}
										: t,
								),
							);
						} else if (eventLine === 'error') {
							setError(payload.message as string);
						}
					}
				}
			} catch (err) {
				setError(String(err));
			} finally {
				setTurns((prev) =>
					prev.map((turn) =>
						turn.turnId === turnId
							? {
									...turn,
									tools: turn.tools.map((entry) =>
										entry.result === undefined
											? { ...entry, result: 'Tool execution completed.' }
											: entry,
									),
								}
							: turn,
					),
				);
				setRunning(false);
				setActiveToolName(null);
				setActiveTurnId(null);
			}
		},
		[running, nextId],
	);

	const submit = useCallback(async () => {
		const prompt = input.trim();
		if (!prompt) return;
		setInput('');
		await runPrompt(prompt);
	}, [input, runPrompt]);

	const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void submit();
		}
	};

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
		const el = e.target;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	};

	const isEmpty = messages.length === 0;
	const showActivity = running && activeToolName !== null;

	return (
		<>
			<header className="shell-bar">
				<span className="shell-bar__app">Financial Agent</span>
				<span className="shell-bar__sep">/</span>
				<span className="shell-bar__sub">SAP Cloud SDK for AI</span>
			</header>

			{error && (
				<div className="error-strip" role="alert">
					{error}
				</div>
			)}

			<div className="layout">
				<ToolRail turns={turns} activeTurnId={activeTurnId} />

				<div className="chat-pane">
					<div
						className="chat-area"
						ref={chatRef}
						role="log"
						aria-live="polite"
						aria-label="Conversation"
					>
						{isEmpty && !running && (
							<div className="empty-state">
								<div className="empty-state__icon" aria-hidden="true">
									<svg
										width="20"
										height="20"
										viewBox="0 0 20 20"
										fill="none"
										aria-hidden="true"
									>
										<path
											d="M10 2C6.13 2 3 4.91 3 8.5c0 1.96.9 3.72 2.34 4.96L5 16l3.2-1.28A8 8 0 0010 15c3.87 0 7-2.91 7-6.5S13.87 2 10 2z"
											fill="white"
										/>
									</svg>
								</div>
								<p className="empty-state__title">Ask the financial agent</p>
								<p className="empty-state__sub">
									Query budgets, journal entries, and forecasts
								</p>
								<fieldset className="suggestions">
									<legend className="suggestions__legend">
										Suggested queries
									</legend>
									{SAMPLE_QUERIES.map((q) => (
										<button
											type="button"
											key={q}
											className="suggestion-btn"
											title={q}
											onClick={() => void runPrompt(q)}
										>
											{q.length > 45 ? `${q.slice(0, 45)}…` : q}
										</button>
									))}
								</fieldset>
							</div>
						)}

						{messages.map((msg) => (
							<MessageBubble key={msg.id} msg={msg} />
						))}

						{showActivity && <ActivityIndicator toolName={activeToolName} />}
					</div>

					<div className="input-panel">
						<div className="input-panel__inner">
							<div className="composer">
								<textarea
									rows={1}
									value={input}
									onChange={handleInput}
									onKeyDown={handleKey}
									placeholder="Ask about budgets, costs, or forecasts…"
									aria-label="Message input"
									disabled={running}
								/>
								<button
									type="button"
									className="btn-send"
									onClick={() => void submit()}
									disabled={running || !input.trim()}
									aria-label="Send message"
								>
									<svg
										width="13"
										height="13"
										viewBox="0 0 13 13"
										fill="none"
										aria-hidden="true"
									>
										<path
											d="M6.5 11V2M3 5.5l3.5-3.5 3.5 3.5"
											stroke="white"
											strokeWidth="1.75"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</button>
							</div>
							<p className="input-hint">Shift+Enter for new line</p>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
