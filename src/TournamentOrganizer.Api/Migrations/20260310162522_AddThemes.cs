using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace TournamentOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddThemes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ThemeId",
                table: "StoreSettings",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Themes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CssClass = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Themes", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Themes",
                columns: new[] { "Id", "CreatedBy", "CreatedOn", "CssClass", "IsActive", "Name", "UpdatedBy", "UpdatedOn" },
                values: new object[,]
                {
                    { 1, "seed", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "theme-default", true, "Default", "seed", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 2, "seed", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "theme-dark", true, "Dark", "seed", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 3, "seed", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "theme-forest", true, "Forest", "seed", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 4, "seed", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "theme-ocean", true, "Ocean", "seed", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) }
                });

            migrationBuilder.CreateIndex(
                name: "IX_StoreSettings_ThemeId",
                table: "StoreSettings",
                column: "ThemeId");

            migrationBuilder.AddForeignKey(
                name: "FK_StoreSettings_Themes_ThemeId",
                table: "StoreSettings",
                column: "ThemeId",
                principalTable: "Themes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StoreSettings_Themes_ThemeId",
                table: "StoreSettings");

            migrationBuilder.DropTable(
                name: "Themes");

            migrationBuilder.DropIndex(
                name: "IX_StoreSettings_ThemeId",
                table: "StoreSettings");

            migrationBuilder.DropColumn(
                name: "ThemeId",
                table: "StoreSettings");
        }
    }
}
