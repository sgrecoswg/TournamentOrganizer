namespace TournamentOrganizer.Api.DTOs;

public record WishlistEntryDto(int Id, int PlayerId, string CardName, int Quantity, decimal? UsdPrice);
public record TradeEntryDto(int Id, int PlayerId, string CardName, int Quantity, decimal? UsdPrice);
public record CreateCardEntryDto(string CardName, int Quantity = 1);
public record BulkUploadResultDto(int Added, List<string> Errors);
public record WishlistCardSupplyDto(string CardName, List<string> SellerPlayerNames);
