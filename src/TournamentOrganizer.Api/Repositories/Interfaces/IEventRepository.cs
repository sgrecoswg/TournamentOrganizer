using TournamentOrganizer.Api.Models;

namespace TournamentOrganizer.Api.Repositories.Interfaces;

public interface IEventRepository
{
    Task<Event?> GetByIdAsync(int id);
    Task<Event?> GetWithDetailsAsync(int id);
    Task<List<Event>> GetAllAsync();
    Task<List<Event>> GetAllWithStoreAsync(int? storeId = null);
    Task<Event> CreateAsync(Event evt);
    Task UpdateAsync(Event evt);
    Task<EventRegistration> RegisterPlayerAsync(EventRegistration registration);
    Task<List<Player>> GetRegisteredPlayersAsync(int eventId);
    Task<bool> IsPlayerRegisteredAsync(int eventId, int playerId);
    Task<Round> CreateRoundAsync(Round round);
    Task<Round?> GetLatestRoundAsync(int eventId);
    Task<Round?> GetLatestRoundWithPairingsAsync(int eventId);
    Task<Round?> GetRoundWithDetailsAsync(int roundId);
    Task<List<Round>> GetRoundsForEventAsync(int eventId);
    Task<EventRegistration?> GetRegistrationAsync(int eventId, int playerId);
    Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eventId);
    Task RemoveRegistrationAsync(EventRegistration registration);
    Task UpdateRegistrationAsync(EventRegistration registration);
    Task<Event?> GetByCheckInTokenAsync(string token);
}
