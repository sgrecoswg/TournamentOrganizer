using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using TournamentOrganizer.Api.DTOs;
using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Repositories.Interfaces;
using TournamentOrganizer.Api.Services.Interfaces;

namespace TournamentOrganizer.Api.Services;

public class TradeService : ITradeService
{
    private readonly ITradeRepository _repo;
    private readonly ICardPriceService _priceService;

    public TradeService(ITradeRepository repo, ICardPriceService priceService)
    {
        _repo = repo;
        _priceService = priceService;
    }

    public async Task<List<TradeEntryDto>> GetByPlayerAsync(int playerId)
    {
        var entries = await _repo.GetByPlayerAsync(playerId);
        var dtos = new List<TradeEntryDto>(entries.Count);
        foreach (var e in entries)
        {
            var price = await _priceService.GetPriceAsync(e.CardName);
            dtos.Add(ToDto(e, price));
        }
        return dtos;
    }

    public async Task<TradeEntryDto> AddAsync(int playerId, CreateCardEntryDto dto)
    {
        var entry = new TradeEntry
        {
            PlayerId = playerId,
            CardName = dto.CardName.Trim(),
            Quantity = dto.Quantity
        };
        await _repo.AddAsync(entry);
        var price = await _priceService.GetPriceAsync(entry.CardName);
        return ToDto(entry, price);
    }

    public Task<bool> DeleteAsync(int id) => _repo.DeleteAsync(id);

    public Task DeleteAllByPlayerAsync(int playerId) => _repo.DeleteAllByPlayerAsync(playerId);

    public async Task<BulkUploadResultDto> BulkAddAsync(int playerId, IFormFile file)
    {
        using var reader = new System.IO.StreamReader(file.OpenReadStream());
        var content = await reader.ReadToEndAsync();
        var lines = content.Split('\n');
        var errors = new List<string>();
        int added = 0;

        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (string.IsNullOrEmpty(line)) continue;

            var match = Regex.Match(line, @"^(\d+)\s+(.+)$");
            if (!match.Success || !int.TryParse(match.Groups[1].Value, out int qty) || qty < 1)
            {
                errors.Add($"Line {i + 1}: invalid format — expected '<qty> <card name>'");
                continue;
            }

            await _repo.AddAsync(new TradeEntry
            {
                PlayerId = playerId,
                CardName = match.Groups[2].Value.Trim(),
                Quantity = qty
            });
            added++;
        }

        return new BulkUploadResultDto(added, errors);
    }

    private static TradeEntryDto ToDto(TradeEntry e, decimal? price)
        => new(e.Id, e.PlayerId, e.CardName, e.Quantity, price);
}
