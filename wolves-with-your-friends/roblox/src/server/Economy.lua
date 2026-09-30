-- Money: every deal pays into the player's Personal money AND the Firm (team) money.
-- Firm money counts toward the daily target; Personal money is for spending.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Net = require(Shared:WaitForChild("Net"))

local Economy = {
	day = 1,
	team = 0, -- firm money earned today
	haul = 0, -- firm money across the whole run
	personal = {} :: { [Player]: number },
	earned = {} :: { [Player]: number }, -- run total per player, for the Final Statement
	calls = {} :: { [Player]: number },
	biggestDeal = { amount = 0, name = "" },
}

function Economy.quota(): number
	return Config.quotaFor(Economy.day)
end

function Economy.sendPersonal(player: Player)
	Net.Money:FireClient(player, { personal = Economy.personal[player] or 0 })
end

function Economy.add(player: Player, amount: number, toTeam: boolean?)
	Economy.personal[player] = (Economy.personal[player] or 0) + amount
	if toTeam ~= false then
		Economy.team += amount
		Economy.haul += amount
		Economy.earned[player] = (Economy.earned[player] or 0) + amount
		if amount > Economy.biggestDeal.amount then
			Economy.biggestDeal = { amount = amount, name = player.DisplayName }
		end
	end
	Economy.sendPersonal(player)
end

function Economy.countCall(player: Player)
	Economy.calls[player] = (Economy.calls[player] or 0) + 1
end

function Economy.startDay()
	Economy.team = 0
	Economy.biggestDeal = { amount = 0, name = "" }
end

function Economy.resetRun()
	Economy.day = 1
	Economy.team = 0
	Economy.haul = 0
	table.clear(Economy.personal)
	table.clear(Economy.earned)
	table.clear(Economy.calls)
	for _, p in Players:GetPlayers() do
		Economy.sendPersonal(p)
	end
end

Players.PlayerRemoving:Connect(function(p)
	Economy.personal[p] = nil
	Economy.calls[p] = nil
	-- earned stays so a player who left still shows up in the Final Statement
end)

return Economy
