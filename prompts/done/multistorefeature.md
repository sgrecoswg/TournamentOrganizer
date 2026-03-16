You are a Senior TDD developer implementing a new feature in this web applicaton working with a Tournament organizer for a Magic the Gathering application

##### Add new page for Store Settings
- we are adding the ability to have multiple stores access the site  
- each store can have their own seetings
- players can be in events across stores
- players ranking carries accross all the stores
- Don't worry about he license functionality yet, we are just getting it ready for another feature
***DataBase***
- New Table `Licenses` with columns (`Id int PK`, `StoreId int FK → Store.Id`, `AppKey string`, `IsActive bit`,`CreatedOn date`, `CreatedBy date`, `UpdatedOn date`, `UpdatedBy date`,`AvailableDate date`,`ExpiresDate date`)
- New Table `Stores` with columns (`id int PK`, `StoreName string`, `License int FK -> License.Id`, `IsActive bit`,`CreatedOn date`, `CreatedBy date`, `UpdatedOn date`, `UpdatedBy date`)
- New table `StoreSettings` with columns (`Id int PK`, `StoreId int FK → Store.Id`, `AllowableTradeDifferential decimal`,`CreatedOn date`, `CreatedBy date`, `UpdatedOn date`, `UpdatedBy date`)
***Back end*** (`src/TournamentOrganizer.Api/`):
    - Add 3 EF Core entities:
        - `License` (`Id int PK`, `StoreId int FK → Store.Id`, `AppKey string`, `IsActive bit`,`CreatedOn date`, `CreatedBy date`, `UpdatedOn date`, `UpdatedBy date`,`AvailableDate date`,`ExpiresDate date`)
        - `Store` (`id int PK`, `StoreName string`, `LicenseId int FK-> License.Id`, `IsActive boolean`,`CreatedOn date`, `CreatedBy date`, `UpdatedOn date`, `UpdatedBy date`), 
        - `StoreSettings` (`Id int PK`, `StoreId int FK → Store.Id`, `AllowableTradeDifferential decimal`,`CreatedOn date`, `CreatedBy date`, `UpdatedOn date`, `UpdatedBy date`)
    - Add `IStoresService` / `StoresService` with `GetAsync()` and `UpsertAsync(dto)`, backed by `IStoreSettingsRepository` / `StoreSettingsRepository`. Register all four as Scoped in `Program.cs`.
    - Add `StoresController` at `GET /api`,  `PUT /api/{id}`,  `Post /api/{id}`. to handle CRUD operations
    - Add `DbSet<Store>` and `DbSet<StoreSettings>` to `AppDbContext`. 
    - Create a migration named `AddStores`.
***Front End***
    - Add `StoreDto { id: number; storeName: string; }` to `api.models.ts`.
    - Add `StoreSettingsDto { storeID:number; allowableTradeDifferential: number }` to `api.models.ts`.
    - Add `getStores()`, `getStore()`,`createStore()` and `updateStore(dto)` to `api.service.ts`.
    - Create a new standalone component `features/stores/store-detail.component.ts` with a form for Store Name (text input) and Allowable Trade Differential (number input, 0–100, labelled as %). Add a Save button that calls `updateStore`.
    - Create a new standalone component `features/stores/store-list.component.ts` with a list of available stores. Each store would be selectable which would navigate to the new `store-detail` component
    Add a Create button that calls `createStore`.    
    - Add route `/stores` to `app.routes.ts` and a "Stores" nav link to the side nav in `app.component.ts` (or wherever the nav links live).
    - Run `/check-zone` on the new component.
    
