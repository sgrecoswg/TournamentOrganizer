using TournamentOrganizer.Api.Models;
using TournamentOrganizer.Api.Services;

namespace TournamentOrganizer.Tests;

public class StandingsCalculationTests
{
    // ------------------------------------------------------------------
    // ScoreBased: 1st=4, 2nd=3, 3rd=2, 4th+=1
    // ------------------------------------------------------------------

    [Theory]
    [InlineData(1, 4)]
    [InlineData(2, 3)]
    [InlineData(3, 2)]
    [InlineData(4, 1)]
    [InlineData(5, 1)]
    public void ScoreBased_NonDraw_CorrectPoints(int position, int expected)
    {
        var points = EventService.CalculatePoints(PointSystem.ScoreBased, position, isDraw: false);
        Assert.Equal(expected, points);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void ScoreBased_Draw_SameAsNonDraw(int position)
    {
        // ScoreBased treats draws the same as normal finish positions
        var draw = EventService.CalculatePoints(PointSystem.ScoreBased, position, isDraw: true);
        var normal = EventService.CalculatePoints(PointSystem.ScoreBased, position, isDraw: false);
        Assert.Equal(normal, draw);
    }

    // ------------------------------------------------------------------
    // WinBased: 1st=5, others=0, draw=1 each
    // ------------------------------------------------------------------

    [Fact]
    public void WinBased_FirstPlace_Gets5Points()
    {
        var points = EventService.CalculatePoints(PointSystem.WinBased, 1, isDraw: false);
        Assert.Equal(5, points);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void WinBased_NonWinner_Gets0Points(int position)
    {
        var points = EventService.CalculatePoints(PointSystem.WinBased, position, isDraw: false);
        Assert.Equal(0, points);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void WinBased_Draw_Everyone_Gets1Point(int position)
    {
        var points = EventService.CalculatePoints(PointSystem.WinBased, position, isDraw: true);
        Assert.Equal(1, points);
    }

    // ------------------------------------------------------------------
    // Unimplemented stubs fall back to ScoreBased
    // ------------------------------------------------------------------

    [Theory]
    [InlineData(PointSystem.VictoryPoints)]
    [InlineData(PointSystem.PointWager)]
    [InlineData(PointSystem.SocialVoting)]
    public void UnimplementedSystems_FallBackToScoreBased(PointSystem system)
    {
        // Stub systems should behave the same as ScoreBased for now
        var stub = EventService.CalculatePoints(system, 1, isDraw: false);
        var scoreBased = EventService.CalculatePoints(PointSystem.ScoreBased, 1, isDraw: false);
        Assert.Equal(scoreBased, stub);
    }

    // ------------------------------------------------------------------
    // FiveOneZero: Win=5, Loss=1, Draw=0
    //   Special: winner from seat 5 in a 5-player pod → 10 pts
    //            winner from seat 3 in a 3-player pod → 10 pts
    // ------------------------------------------------------------------

    [Fact]
    public void FiveOneZero_Winner_StandardPod_Gets5Points()
    {
        var points = EventService.CalculatePoints(PointSystem.FiveOneZero, 1, isDraw: false, seatOrder: 1, podSize: 4);
        Assert.Equal(5, points);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void FiveOneZero_NonWinner_Gets1Point(int position)
    {
        var points = EventService.CalculatePoints(PointSystem.FiveOneZero, position, isDraw: false, seatOrder: position, podSize: 4);
        Assert.Equal(1, points);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void FiveOneZero_Draw_Gets0Points(int position)
    {
        var points = EventService.CalculatePoints(PointSystem.FiveOneZero, position, isDraw: true, seatOrder: position, podSize: 4);
        Assert.Equal(0, points);
    }

    [Fact]
    public void FiveOneZero_Winner_Seat5_In5PlayerPod_Gets10Points()
    {
        var points = EventService.CalculatePoints(PointSystem.FiveOneZero, 1, isDraw: false, seatOrder: 5, podSize: 5);
        Assert.Equal(10, points);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void FiveOneZero_Winner_NotSeat5_In5PlayerPod_Gets5Points(int seat)
    {
        var points = EventService.CalculatePoints(PointSystem.FiveOneZero, 1, isDraw: false, seatOrder: seat, podSize: 5);
        Assert.Equal(5, points);
    }

    [Fact]
    public void FiveOneZero_Winner_Seat3_In3PlayerPod_Gets10Points()
    {
        var points = EventService.CalculatePoints(PointSystem.FiveOneZero, 1, isDraw: false, seatOrder: 3, podSize: 3);
        Assert.Equal(10, points);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public void FiveOneZero_Winner_NotSeat3_In3PlayerPod_Gets5Points(int seat)
    {
        var points = EventService.CalculatePoints(PointSystem.FiveOneZero, 1, isDraw: false, seatOrder: seat, podSize: 3);
        Assert.Equal(5, points);
    }

    [Fact]
    public void FiveOneZero_Seat5_Wins_Draw_Gets0Points()
    {
        // Seat bonus doesn't apply to draws
        var points = EventService.CalculatePoints(PointSystem.FiveOneZero, 1, isDraw: true, seatOrder: 5, podSize: 5);
        Assert.Equal(0, points);
    }

    // ------------------------------------------------------------------
    // SeatBased: winner earns 6+seat pts (seat1=7..seat4=10), non-winners=0
    //   Special: seat5 in 5-player pod → 10, seat3 in 3-player pod → 10
    // ------------------------------------------------------------------

    [Theory]
    [InlineData(1, 7)]
    [InlineData(2, 8)]
    [InlineData(3, 9)]
    [InlineData(4, 10)]
    public void SeatBased_Winner_StandardPod_PointsBySeqat(int seat, int expected)
    {
        var points = EventService.CalculatePoints(PointSystem.SeatBased, 1, isDraw: false, seatOrder: seat, podSize: 4);
        Assert.Equal(expected, points);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void SeatBased_NonWinner_Gets0Points(int position)
    {
        var points = EventService.CalculatePoints(PointSystem.SeatBased, position, isDraw: false, seatOrder: 1, podSize: 4);
        Assert.Equal(0, points);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void SeatBased_Draw_Gets0Points(int position)
    {
        var points = EventService.CalculatePoints(PointSystem.SeatBased, position, isDraw: true, seatOrder: position, podSize: 4);
        Assert.Equal(0, points);
    }

    [Fact]
    public void SeatBased_Winner_Seat5_In5PlayerPod_Gets10Points()
    {
        var points = EventService.CalculatePoints(PointSystem.SeatBased, 1, isDraw: false, seatOrder: 5, podSize: 5);
        Assert.Equal(10, points);
    }

    [Theory]
    [InlineData(1, 7)]
    [InlineData(2, 8)]
    [InlineData(3, 9)]
    [InlineData(4, 10)]
    public void SeatBased_Winner_Seats1to4_In5PlayerPod_FollowNormalRules(int seat, int expected)
    {
        var points = EventService.CalculatePoints(PointSystem.SeatBased, 1, isDraw: false, seatOrder: seat, podSize: 5);
        Assert.Equal(expected, points);
    }

    [Fact]
    public void SeatBased_Winner_Seat3_In3PlayerPod_Gets10Points()
    {
        var points = EventService.CalculatePoints(PointSystem.SeatBased, 1, isDraw: false, seatOrder: 3, podSize: 3);
        Assert.Equal(10, points);
    }

    [Theory]
    [InlineData(1, 7)]
    [InlineData(2, 8)]
    public void SeatBased_Winner_Seats1to2_In3PlayerPod_FollowNormalRules(int seat, int expected)
    {
        var points = EventService.CalculatePoints(PointSystem.SeatBased, 1, isDraw: false, seatOrder: seat, podSize: 3);
        Assert.Equal(expected, points);
    }
}
