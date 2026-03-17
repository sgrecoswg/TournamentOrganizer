using Microsoft.EntityFrameworkCore;
using TournamentOrganizer.Api.Data;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;

namespace TournamentOrganizer.Api.Repositories;

public class EventRepository : IEventRepository
{
    private readonly AppDbContext _db;

    public EventRepository(AppDbContext db) => _db = db;

    public async Task<Event?> GetByIdAsync(int id)
        => await _db.Events.FindAsync(id);

    public async Task<Event?> GetWithDetailsAsync(int id)
        => await _db.Events
            .Include(e => e.Registrations).ThenInclude(r => r.Player)
            .Include(e => e.Rounds).ThenInclude(r => r.Pods).ThenInclude(p => p.PodPlayers)
            .Include(e => e.Rounds).ThenInclude(r => r.Pods).ThenInclude(p => p.Game).ThenInclude(g => g!.Results).ThenInclude(r => r.Player)
            .FirstOrDefaultAsync(e => e.Id == id);

    public async Task<List<Event>> GetAllAsync()
        => await _db.Events.OrderByDescending(e => e.Date).ToListAsync();

    public async Task<List<Event>> GetAllWithStoreAsync(int? storeId = null)
    {
        var query = _db.Events
            .Include(e => e.StoreEvent).ThenInclude(se => se!.Store)
            .OrderByDescending(e => e.Date)
            .AsQueryable();

        if (storeId.HasValue)
            query = query.Where(e => e.StoreEvent != null && e.StoreEvent.StoreId == storeId.Value);

        return await query.ToListAsync();
    }

    public async Task<Event> CreateAsync(Event evt)
    {
        _db.Events.Add(evt);
        await _db.SaveChangesAsync();
        return evt;
    }

    public async Task UpdateAsync(Event evt)
    {
        _db.Events.Update(evt);
        await _db.SaveChangesAsync();
    }

    public async Task<EventRegistration> RegisterPlayerAsync(EventRegistration registration)
    {
        _db.EventRegistrations.Add(registration);
        await _db.SaveChangesAsync();
        return registration;
    }

    public async Task<List<Player>> GetRegisteredPlayersAsync(int eventId)
        => await _db.EventRegistrations
            .Where(er => er.EventId == eventId && !er.IsDropped && !er.IsDisqualified)
            .Select(er => er.Player)
            .ToListAsync();

    public async Task<bool> IsPlayerRegisteredAsync(int eventId, int playerId)
        => await _db.EventRegistrations
            .AnyAsync(er => er.EventId == eventId && er.PlayerId == playerId && !er.IsDropped && !er.IsDisqualified);

    public async Task<Round> CreateRoundAsync(Round round)
    {
        _db.Rounds.Add(round);
        await _db.SaveChangesAsync();
        return round;
    }

    public async Task<Round?> GetLatestRoundAsync(int eventId)
        => await _db.Rounds
            .Include(r => r.Pods).ThenInclude(p => p.Game).ThenInclude(g => g!.Results).ThenInclude(r => r.Player)
            .Where(r => r.EventId == eventId)
            .OrderByDescending(r => r.RoundNumber)
            .FirstOrDefaultAsync();

    public async Task<Round?> GetLatestRoundWithPairingsAsync(int eventId)
        => await _db.Rounds
            .Include(r => r.Pods).ThenInclude(p => p.PodPlayers).ThenInclude(pp => pp.Player)
            .Include(r => r.Pods).ThenInclude(p => p.Game).ThenInclude(g => g!.Results)
            .Where(r => r.EventId == eventId)
            .OrderByDescending(r => r.RoundNumber)
            .FirstOrDefaultAsync();

    public async Task<Round?> GetRoundWithDetailsAsync(int roundId)
        => await _db.Rounds
            .Include(r => r.Pods).ThenInclude(p => p.Game).ThenInclude(g => g!.Results).ThenInclude(r => r.Player)
            .FirstOrDefaultAsync(r => r.Id == roundId);

    public async Task<List<Round>> GetRoundsForEventAsync(int eventId)
        => await _db.Rounds
            .Include(r => r.Pods).ThenInclude(p => p.PodPlayers).ThenInclude(pp => pp.Player)
            .Include(r => r.Pods).ThenInclude(p => p.Game).ThenInclude(g => g!.Results).ThenInclude(r => r.Player)
            .Where(r => r.EventId == eventId)
            .OrderBy(r => r.RoundNumber)
            .ToListAsync();

    public async Task<EventRegistration?> GetRegistrationAsync(int eventId, int playerId)
        => await _db.EventRegistrations
            .Include(er => er.Player)
            .FirstOrDefaultAsync(er => er.EventId == eventId && er.PlayerId == playerId);

    public async Task<List<EventRegistration>> GetRegistrationsWithPlayersAsync(int eventId)
        => await _db.EventRegistrations
            .Include(er => er.Player)
            .Where(er => er.EventId == eventId)
            .ToListAsync();

    public async Task RemoveRegistrationAsync(EventRegistration registration)
    {
        _db.EventRegistrations.Remove(registration);
        await _db.SaveChangesAsync();
    }

    public async Task UpdateRegistrationAsync(EventRegistration registration)
    {
        _db.EventRegistrations.Update(registration);
        await _db.SaveChangesAsync();
    }

    public async Task<Event?> GetByCheckInTokenAsync(string token)
        => await _db.Events.FirstOrDefaultAsync(e => e.CheckInToken == token);
}
