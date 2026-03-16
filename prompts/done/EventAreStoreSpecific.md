**Task:** We added a `StoreEvent` join entity so each `Event` belongs to a `Store` (one-to-many). We need to implement the changed in the frontend
> **Frontend (`tournament-client/`)**
> - Event create/edit form: add Store dropdown (`GET /api/stores`), pre-select active store in `tournament-client\src\app\features\events\event-list.component.ts`.
> - `tournament-client\src\app\core\models\api.models.ts` needs to be updated with th storeid ~line 86
> - Store detail page (`store-detail.component.ts` or equivalent): add collapsible panel listing associated events.

## Prompt Refinement Suggestions

### Token Efficiency


### Anticipated Questions (pre-answer these to skip back-and-forth)


- Q: How does the frontend know which store is active when creating an event? → **Suggested answer:** Show a dropdown populated from `GET /api/stores`; pre-select the currently active store.




