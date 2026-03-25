using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TournamentOrganizer.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStoreGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StoreGroupId",
                table: "Stores",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StoreGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    LogoUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreGroups", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Stores_StoreGroupId",
                table: "Stores",
                column: "StoreGroupId");

            migrationBuilder.AddForeignKey(
                name: "FK_Stores_StoreGroups_StoreGroupId",
                table: "Stores",
                column: "StoreGroupId",
                principalTable: "StoreGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Stores_StoreGroups_StoreGroupId",
                table: "Stores");

            migrationBuilder.DropTable(
                name: "StoreGroups");

            migrationBuilder.DropIndex(
                name: "IX_Stores_StoreGroupId",
                table: "Stores");

            migrationBuilder.DropColumn(
                name: "StoreGroupId",
                table: "Stores");
        }
    }
}
