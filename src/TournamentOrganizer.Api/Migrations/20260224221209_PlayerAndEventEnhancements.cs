using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TournamentOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class PlayerAndEventEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Players",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "DefaultRoundTimeMinutes",
                table: "Events",
                type: "int",
                nullable: false,
                defaultValue: 55);

            migrationBuilder.AddColumn<string>(
                name: "DecklistUrl",
                table: "EventRegistrations",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDisqualified",
                table: "EventRegistrations",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDropped",
                table: "EventRegistrations",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Players");

            migrationBuilder.DropColumn(
                name: "DefaultRoundTimeMinutes",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "DecklistUrl",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "IsDisqualified",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "IsDropped",
                table: "EventRegistrations");
        }
    }
}
