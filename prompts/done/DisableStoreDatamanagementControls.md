# Task
we should check if the api does not respond when the user goes to the stores-details datamanagement tab. if it os not responding, disable the 'pull from server' and 'sync to server' buttons
## Backend
***SQL***
none
***Databse***
none
***API***(`src/TournamentOrganizer.Api/`)
nne
## *Frontend*
**tournament-client\src\app\features\stores\store-detail.component.ts**
Given a user can access the store-detail.component
When the api is not responding of off line
and I update the store name
then the store name should update in the local storage and be synced on next sync to database. It does not

