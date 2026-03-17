# Feature: AI Agent Interface

> **GitHub Issue:** [#39 feat: AI Agent Interface (streaming chat with tool calling)](https://github.com/sgrecoswg/TournamentOrganizer/issues/39)

## Context
A full-page AI chat assistant at `/ai-agent`, accessible to `StoreManager`, `Administrator`, and a new `Developer` role. The agent uses tool/function calling to read and act on application data within the caller's permission boundary. Responses stream token-by-token via SSE. The AI provider (Claude, GPT-4, etc.) is selectable at runtime from the chat UI.

---

## Requirements

- New `Developer = 4` value added to `AppUserRole` enum; real DB role issued in JWT
- New `"Developer"` and `"AiAgent"` auth policies in `Program.cs`
- `isDeveloper` getter added to `AuthService` and `App` component
- Backend: `IAiProvider` abstraction — `AnthropicProvider` first, `OpenAiProvider` stubbed
- Runtime provider selection: `mat-select` in the chat UI; available providers come from `GET /api/ai-agent/providers`
- API keys stored in `appsettings.json` under `AiProviders`
- Streaming: backend returns `text/event-stream` (SSE); frontend reads via `fetch` + `ReadableStream` (not `HttpClient` — `EventSource` does not support POST)
- Tool/function calling: AI receives a role-scoped tool list, calls tools, backend executes them against existing services, results fed back into the conversation turn
- Chat history: sessionStorage for StoreManager / Admin; localStorage for Developer
- Nav link "AI Agent" (icon: `smart_toy`) visible only to Admin and Developer

### Tool capabilities by role

**StoreManager** (all calls scoped to `storeId` from JWT — cannot cross stores):
- `list_events` — events for their store
- `get_event(eventId)` — event details + player list
- `create_event(name, date, maxPlayers?, defaultRoundTimeMinutes?, pointSystem?)`
- `update_event_status(eventId, status)`
- `list_players` — players registered at their store
- `get_player(playerId)`
- `register_player_for_event(eventId, playerId, decklistUrl?, commanders?)`
- `drop_player_from_event(eventId, playerId)`
- `get_standings(eventId)`
- `list_store_employees` — employees at their store
- `get_store_settings` — their store settings
- `update_store_settings(settings)`

**Administrator** (same tools, no store-scoping, plus cross-store tools):
- Everything StoreManager can do (without store-scope restriction) +
- `list_stores`
- `get_store(storeId)`
- `list_all_users` — all AppUsers
- `update_user_role(userId, role)` — promote / demote (cannot set Developer — Developer only)
- `get_leaderboard`

**Developer** (everything Administrator + server/diagnostic operations):
- Everything Administrator can do +
- `update_user_role` can also set `Developer` role
- `get_error_logs(lines?)` — tail the application log file
- `get_recent_api_errors(count?)` — last N 5xx responses logged in-process
- `get_migration_status` — EF migrations list (applied / pending)
- `get_health_check` — DB connection test + process uptime
- `get_memory_stats` — process RSS memory + CPU time
- `recycle_app_pool(appPoolName?)` — IIS app pool recycle via `IDevOpsChannel` (local `appcmd` initially; remote WinRM in a future phase)
- `get_active_session_count` — approximate count of non-expired JWTs issued

---

## Backend (`src/TournamentOrganizer.Api/`)

### Database / EF Core
- Add `Developer = 4` to `AppUserRole` enum in `Models/AppUser.cs`
- New entity `AiChatSession` (`Id int PK`, `UserId int FK → AppUser.Id`, `Provider string`, `CreatedAt DateTime`, `UpdatedAt DateTime`)
- New entity `AiChatMessage` (`Id int PK`, `SessionId int FK → AiChatSession.Id`, `Role string` [user/assistant/tool_result], `Content string`, `ToolName string?`, `CreatedAt DateTime`)
- Add `DbSet<AiChatSession>` and `DbSet<AiChatMessage>` to `AppDbContext`
- Run `/migrate AddDeveloperRoleAndAiChatHistory`

### Models / Entities (`Models/`)
- `AiChatSession.cs` — new EF Core entity (fields above)
- `AiChatMessage.cs` — new EF Core entity (fields above)

### DTOs (`DTOs/`)
- `ChatRequestDto` — `{ Messages: List<ChatMessageDto>, Provider: string }`
- `ChatMessageDto` — `{ Role: string, Content: string, ToolName: string? }`
- `AiProviderInfoDto` — `{ Name: string, DisplayName: string, IsAvailable: bool }`

### AI Provider abstraction (`Services/AiAgent/`)

**Interfaces:**
- `IAiProvider`
  - `string Name { get; }`
  - `bool IsAvailable { get; }` — true when API key is configured
  - `Task StreamAsync(IReadOnlyList<ChatMessageDto> messages, IReadOnlyList<AiToolDefinition> tools, string systemPrompt, HttpResponse response, CancellationToken ct)`
- `IAiProviderFactory`
  - `IAiProvider GetProvider(string name)`
  - `IReadOnlyList<AiProviderInfoDto> GetAvailable()`
- `IAiToolRegistry`
  - `IReadOnlyList<AiToolDefinition> GetToolsForRole(string role)`
- `IAiTool`
  - `string Name { get; }`
  - `string Description { get; }`
  - `JsonElement InputSchema { get; }`
  - `IReadOnlyList<string> AllowedRoles { get; }` — e.g. `["StoreManager","Administrator","Developer"]`
  - `Task<string> ExecuteAsync(JsonElement args, int? storeId, ClaimsPrincipal user)`
- `IDevOpsChannel`
  - `Task<string> RecycleAppPoolAsync(string? appPoolName, CancellationToken ct)`
  - `Task<string> GetErrorLogsAsync(int lines, CancellationToken ct)`
  - `bool IsRemote { get; }`

**Implementations (`Services/AiAgent/Providers/`):**
- `AnthropicProvider : IAiProvider` — POSTs to `https://api.anthropic.com/v1/messages` with `"stream": true`; forwards `content_block_delta` SSE events as `data: <text>\n\n` to Angular; handles `tool_use` blocks by dispatching to `IAiToolRegistry`
- `OpenAiProvider : IAiProvider` — POSTs to OpenAI Chat Completions with `stream: true` — **stubbed in v1, returns `IsAvailable = false` unless key is set**
- `AiProviderFactory : IAiProviderFactory` — resolves by name from registered `IEnumerable<IAiProvider>`

**Tool implementations (`Services/AiAgent/Tools/`):**

Read-only (Phase 1):
- `ListEventsTool`, `GetEventTool`
- `ListPlayersTool`, `GetPlayerTool`
- `GetStandingsTool`
- `ListStoresTool`, `GetStoreTool`
- `ListUsersTool`
- `GetLeaderboardTool`
- `GetStoreSettingsTool`
- `ListStoreEmployeesTool`
- `GetHealthCheckTool`, `GetMigrationStatusTool`, `GetMemoryStatsTool`, `GetErrorLogsTool`, `GetActiveSessionCountTool` (Developer-only)

Write actions (Phase 2):
- `CreateEventTool`, `UpdateEventStatusTool`
- `RegisterPlayerTool`, `DropPlayerTool`
- `UpdateUserRoleTool`
- `UpdateStoreSettingsTool`

Server actions (Phase 3):
- `RecycleAppPoolTool` — delegates to `IDevOpsChannel`

**DevOps channel (`Services/AiAgent/DevOps/`):**
- `LocalDevOpsChannel : IDevOpsChannel` — shells out via `Process.Start` to `appcmd recycle apppool /apppool.name:<name>`, reads from log file path in config
- `RemoteDevOpsChannel : IDevOpsChannel` — placeholder for WinRM/SSH (Phase 3)

### Authorization (`Program.cs`)
```csharp
// Add alongside existing policies:
options.AddPolicy("Developer", p => p.RequireAssertion(ctx =>
    ctx.User.HasClaim("role", "Developer")));

options.AddPolicy("AiAgent", p => p.RequireAssertion(ctx =>
    ctx.User.HasClaim("role", "StoreManager")  ||
    ctx.User.HasClaim("role", "Administrator") ||
    ctx.User.HasClaim("role", "Developer")));
```

### Config (`appsettings.json`)
```json
"AiProviders": {
  "Anthropic": {
    "ApiKey": "",
    "Model": "claude-sonnet-4-6"
  },
  "OpenAi": {
    "ApiKey": "",
    "Model": "gpt-4o"
  }
},
"DevOps": {
  "LogFilePath": "logs/app-.log",
  "DefaultAppPool": "TournamentOrganizer"
}
```

### Controller (`Controllers/AiAgentController.cs`)
- `AiAgentController` at `/api/ai-agent` — `[Authorize(Policy = "AiAgent")]`
  - `GET /api/ai-agent/providers` → `AiProviderInfoDto[]` — lists all providers with `IsAvailable`
  - `POST /api/ai-agent/chat` → `text/event-stream` — streams assistant response; body is `ChatRequestDto`; sets `Cache-Control: no-cache`, `X-Accel-Buffering: no`
  - `GET /api/ai-agent/history` `[Authorize(Policy = "Developer")]` → `AiChatSession[]` with messages — Developer persistent history

### Service registrations (`Program.cs`)
```csharp
builder.Services.AddScoped<IAiProvider, AnthropicProvider>();
builder.Services.AddScoped<IAiProvider, OpenAiProvider>();
builder.Services.AddScoped<IAiProviderFactory, AiProviderFactory>();
builder.Services.AddScoped<IAiToolRegistry, AiToolRegistry>();
builder.Services.AddScoped<IDevOpsChannel, LocalDevOpsChannel>();
// Register each IAiTool:
builder.Services.AddScoped<IAiTool, ListEventsTool>();
// ... (one line per tool)
```

---

## Frontend (`tournament-client/src/app/`)

### Models (`core/models/api.models.ts`)
- Update `CurrentUser.role` union to include `'Developer'`
- Add `ChatMessageDto { role: 'user' | 'assistant' | 'tool_result'; content: string; toolName?: string; isStreaming?: boolean }`
- Add `AiProviderDto { name: string; displayName: string; isAvailable: boolean }`

### API Service (`core/services/api.service.ts`)
- Add `getAiProviders(): Observable<AiProviderDto[]>`
- Add `streamChat(messages: ChatMessageDto[], provider: string): Promise<ReadableStreamDefaultReader<Uint8Array>>` — uses `fetch('/api/ai-agent/chat', { method: 'POST', ... })`, returns response body reader for SSE parsing

### Feature Service (`features/ai-agent/ai-agent.service.ts`)
- `messages$ = new BehaviorSubject<ChatMessageDto[]>([])`
- `isStreaming$ = new BehaviorSubject<boolean>(false)`
- `selectedProvider$ = new BehaviorSubject<string>('Anthropic')`
- `providers$ = new BehaviorSubject<AiProviderDto[]>([])`
- `loadProviders(): void` — calls `api.getAiProviders()`, updates `providers$`
- `sendMessage(userText: string): void` — appends user message to subject, calls `api.streamChat(...)`, reads stream in a loop appending deltas to the last assistant message, calls `cdr.detectChanges()` per chunk
- `clearHistory(): void` — resets `messages$` to `[]`; persists to sessionStorage (non-dev) or localStorage (Developer)
- History hydration on init — restore from sessionStorage / localStorage based on role

### Auth Service (`core/services/auth.service.ts`)
- Add `get isDeveloper(): boolean { return this.currentUser?.role === 'Developer'; }`
- Add `get canAccessAiAgent(): boolean` — `isStoreManager || isAdmin || isDeveloper`

### App component (`app.ts` + `app.html`)
- Add `get isDeveloper(): boolean` delegating to `authService.isDeveloper`
- Add to `app.html` sidenav (below Stores link):
  ```html
  @if (isAdmin || isDeveloper) {
    <a mat-list-item routerLink="/ai-agent" routerLinkActive="active">
      <mat-icon matListItemIcon>smart_toy</mat-icon>
      <span matListItemTitle>AI Agent</span>
    </a>
  }
  ```

### Components
- **`features/ai-agent/ai-agent.component.ts`** — standalone full-page chat
  - Template selectors (must match E2E specs exactly):
    - Page heading: `<h2>AI Agent</h2>`
    - Provider selector label: `AI Provider`
    - Provider `mat-select`: `data-testid="provider-select"`
    - Message list container: `class="message-list"`
    - User message bubble: `class="message user-message"`
    - Assistant message bubble: `class="message assistant-message"`
    - Tool use chip inside assistant message: `class="tool-use-chip"`
    - Streaming cursor (show while `isStreaming$`): `class="streaming-cursor"`
    - Text input label: `Message`
    - Send button text: `Send`
    - Clear button text: `Clear History`
    - Empty state paragraph: `Start a conversation — ask about events, players, standings, or issue a command.`
  - Streaming loop: decode `Uint8Array` → UTF-8 → parse `data:` lines → append text delta to last assistant message → `cdr.detectChanges()`
  - Tool use display: when SSE event type is `tool_use`, append a `tool_result` message with `toolName` visible as a chip before the next assistant text delta

### Routing (`app.routes.ts`)
```typescript
{
  path: 'ai-agent',
  loadComponent: () => import('./features/ai-agent/ai-agent.component').then(m => m.AiAgentComponent)
}
```

### Post-implementation checklist
- [ ] Run `/check-zone` on `ai-agent.component.ts`

---

## Backend Unit Tests (`src/TournamentOrganizer.Tests/`)

**`AiToolRegistryTests`**
- `GetToolsForRole_StoreManager_ExcludesAdminAndDevTools`
- `GetToolsForRole_Administrator_IncludesStoreManagerTools`
- `GetToolsForRole_Developer_IncludesAllTools`
- `GetToolsForRole_UnknownRole_ReturnsEmpty`

**`AnthropicProviderTests`** (mock `HttpClient`)
- `StreamAsync_SendsCorrectApiKeyHeader`
- `StreamAsync_IncludesToolDefinitionsInRequest`
- `StreamAsync_ForwardsTextDeltaEventsToResponse`
- `StreamAsync_DispatchesToolCallToRegistry`
- `StreamAsync_HandlesApiErrorGracefully`

**`ListEventsTool_Tests`**
- `ExecuteAsync_StoreManager_ScopedToTheirStore`
- `ExecuteAsync_Administrator_ReturnsAllStores`
- `ExecuteAsync_ReturnsFormattedJson`

Run with: `dotnet test --filter "FullyQualifiedName~AiToolRegistryTests|FullyQualifiedName~AnthropicProviderTests"`

---

## Frontend Unit Tests (Jest)

**`features/ai-agent/ai-agent.component.spec.ts`**

Online path:
- calls `aiAgentService.loadProviders()` on init
- renders each `ChatMessageDto` from `messages$`
- Send button disabled when input is empty
- clicking Send calls `aiAgentService.sendMessage()` with typed text and clears input
- shows `.streaming-cursor` while `isStreaming$` is `true`, hides it when `false`
- `tool_result` messages render `.tool-use-chip` with `toolName`

Role / display:
- provider `mat-select` is rendered and bound to `selectedProvider$`
- Clear History button clears `messages$`

Error path:
- streaming error appends an error message to the conversation
- `isStreaming$` returns to `false` after error

Run with: `npx jest --config jest.config.js --testPathPatterns=ai-agent.component`

---

## Frontend E2E Tests (Playwright)

**File: `e2e/ai-agent/ai-agent.spec.ts`**

Helpers needed in `e2e/helpers/api-mock.ts`:
- `mockGetAiProviders(page, providers: AiProviderDto[])` — intercepts `GET /api/ai-agent/providers`
- `mockAiChat(page, responseChunks: string[])` — intercepts `POST /api/ai-agent/chat`, responds with a fake SSE stream
- `makeAiProviderDto(overrides?)` — fixture builder

Describe blocks:

| Describe | Tests |
|---|---|
| `AI Agent — heading` | `<h2>AI Agent</h2>` is visible |
| `AI Agent — empty state` | shows empty-state paragraph, no message bubbles |
| `AI Agent — role gating: Player` | nav link absent; navigating to `/ai-agent` shows unauthorized or redirects |
| `AI Agent — role gating: StoreManager` | page accessible |
| `AI Agent — role gating: Admin` | page accessible, nav link visible |
| `AI Agent — provider selector` | dropdown shows available providers; unavailable ones disabled |
| `AI Agent — send message (happy path)` | type message → click Send → user bubble appears → assistant bubble streams in with mock chunks |
| `AI Agent — tool use display` | mock SSE includes a tool_use event → `.tool-use-chip` visible in conversation |
| `AI Agent — send disabled when empty` | Send button disabled with blank input, enabled after typing |
| `AI Agent — clear history` | send a message, click Clear History → message list empty |
| `AI Agent — session persistence` | send a message, reload page → message restored from sessionStorage (Admin) |

Run with: `/e2e e2e/ai-agent/ai-agent.spec.ts`
**All tests must pass before the task is considered done.**

---

## Phasing

| Phase | Scope |
|---|---|
| **1 — Foundation** | Provider abstraction + streaming UI shell + Developer role + read-only tools (list/get) for all roles |
| **2 — Write actions** | Create event, register/drop player, update user role, update store settings tools |
| **3 — Developer server tools** | Log tailing, app pool recycle, health check; `IDevOpsChannel` remote implementation |
| **4 — Persistent history** | `AiChatSession` / `AiChatMessage` DB storage for Developer; `GET /api/ai-agent/history` |

---

## Verification Checklist

- [ ] `/build` — 0 errors on both .NET and Angular
- [ ] `dotnet test --filter "FullyQualifiedName~AiToolRegistry|FullyQualifiedName~AnthropicProvider"` — all pass
- [ ] `npx jest --config jest.config.js --testPathPatterns=ai-agent` — all pass
- [ ] `/e2e e2e/ai-agent/ai-agent.spec.ts` — all pass
- [ ] `/check-zone` on `ai-agent.component.ts` — clean
