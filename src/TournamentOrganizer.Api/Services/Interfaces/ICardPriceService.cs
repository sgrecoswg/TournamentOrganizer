namespace TournamentOrganizer.Api.Services.Interfaces;

public interface ICardPriceService
{
    Task<decimal?> GetPriceAsync(string cardName);
}
