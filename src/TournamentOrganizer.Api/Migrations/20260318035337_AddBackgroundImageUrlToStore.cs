using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TournamentOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBackgroundImageUrlToStore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BackgroundImageUrl",
                table: "Stores",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PlayerBadges",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PlayerId = table.Column<int>(type: "int", nullable: false),
                    BadgeKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AwardedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EventId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerBadges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlayerBadges_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerBadges_PlayerId_BadgeKey",
                table: "PlayerBadges",
                columns: new[] { "PlayerId", "BadgeKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlayerBadges");

            migrationBuilder.DropColumn(
                name: "BackgroundImageUrl",
                table: "Stores");
        }
    }
}
