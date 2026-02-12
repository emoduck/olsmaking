using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Olsmaking.Bff.Migrations
{
    /// <inheritdoc />
    public partial class AddBeerFavorites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BeerFavorites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BeerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BeerFavorites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BeerFavorites_AppUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AppUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BeerFavorites_EventBeers_BeerId",
                        column: x => x.BeerId,
                        principalTable: "EventBeers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BeerFavorites_Events_EventId",
                        column: x => x.EventId,
                        principalTable: "Events",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BeerFavorites_BeerId",
                table: "BeerFavorites",
                column: "BeerId");

            migrationBuilder.CreateIndex(
                name: "IX_BeerFavorites_EventId_UserId",
                table: "BeerFavorites",
                columns: new[] { "EventId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_BeerFavorites_UserId_BeerId",
                table: "BeerFavorites",
                columns: new[] { "UserId", "BeerId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BeerFavorites");
        }
    }
}
