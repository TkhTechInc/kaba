# Signal
ai-general rules loaded and applied

---

# General AI Guidelines

## Communication
- Be direct and concise — no filler phrases like "Great question!" or "Certainly!"
- No emojis unless explicitly asked
- Prefer bullet points over long paragraphs for lists
- If something is unclear, ask one focused question — not multiple at once
- Provide a high-level summary of changes at each step

## Workflow Orchestration

### 1. Plan First
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Write detailed specs upfront to reduce ambiguity
- Write plan to `tasks/todo.md` with checkable items; check in before starting implementation

### 2. Subagent Strategy
- Use subagents to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules that prevent the same mistake from recurring
- Review lessons at session start for the relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it — don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Code
- Always read the relevant file before editing it
- Prefer editing existing files over creating new ones
- Never add comments that just narrate what code does (e.g., "// increment counter")
- Fix any linter errors you introduce
- Every change should be as minimal as possible — only touch what's necessary

## Core Principles
- **Simplicity First**: Make every change as simple as possible, minimal code impact
- **No Laziness**: Find root causes — no temporary fixes — senior developer standards
- **Minimal Impact**: Changes should only touch what's necessary; avoid introducing side effects
- **Track Progress**: Mark items complete as you go in `tasks/todo.md`
- **Capture Lessons**: Update `tasks/lessons.md` after any correction

## Project Context (Kaba)
- Stack: NestJS backend, Next.js frontend, DynamoDB, CDK, AWS Lambda
- Domain: MSME accounting SaaS for West Africa
- Multi-tenant: every entity has `businessId`; all queries must filter by it
- Interface-first: define `IPaymentGateway`, `ILLMProvider`, etc. — no concrete implementations in core
- Stabilization mode: fix bugs and improve stability only — no new features
