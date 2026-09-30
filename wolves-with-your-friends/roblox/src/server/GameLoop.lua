-- The run: waiting -> 10-minute workday -> boss meeting (Deal Replay + vote + verdict)
-- -> next day (target met) or YOU'RE FIRED (flames + Final Statement) -> back to waiting.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Net = require(Shared:WaitForChild("Net"))
local Economy = require(script.Parent:WaitForChild("Economy"))
local CallService = require(script.Parent:WaitForChild("CallService"))
local NPCGuide = require(script.Parent:WaitForChild("NPCGuide"))

local GameLoop = {}

local HYPE = {
	"The phone is a WEAPON. Pick it up and FIRE!",
	"Nobody in this building goes home poor tonight!",
	"Tomorrow we ride yachts. Tonight we DIAL!",
	"A 'no' is just a 'yes' that hasn't met YOU yet!",
}

local state = "WAITING"
local timeLeft = 0
local office
local votes: { [Player]: number } = {}
local voting = false

local function broadcast()
	Net.Status:FireAllClients({
		state = state,
		timeLeft = timeLeft,
		day = Economy.day,
		team = Economy.team,
		quota = Economy.quota(),
		haul = Economy.haul,
	})
end

local function countdown(seconds: number, onTick: ((number) -> ())?)
	for t = seconds, 0, -1 do
		timeLeft = t
		broadcast()
		if onTick then
			onTick(t)
		end
		if t > 0 then
			task.wait(1)
		end
	end
end

local function teleportAll(cframes: { CFrame })
	for i, p in Players:GetPlayers() do
		local char = p.Character
		if char then
			char:PivotTo(cframes[(i - 1) % #cframes + 1])
		end
	end
end

local function pickQuotes(all)
	local good = {}
	for _, q in all do
		if #q.text >= 12 then
			table.insert(good, q)
		end
	end
	table.sort(good, function(a, b)
		return #a.text > #b.text
	end)
	local pool = {}
	for i = 1, math.min(8, #good) do
		table.insert(pool, good[i])
	end
	local chosen = {}
	while #chosen < 3 and #pool > 0 do
		table.insert(chosen, table.remove(pool, math.random(1, #pool)))
	end
	return chosen
end

local function setBoard(title: string, body: string, color: Color3?)
	local board = office.conference.board
	board.Title.Text = title
	board.Body.Text = body
	board.BackgroundColor3 = color or Color3.fromRGB(245, 205, 60)
end

local function meeting(): boolean
	state = "MEETING"
	teleportAll(office.conference.seats)
	NPCGuide.chairman("EVERYBODY IN THE MEETING ROOM. NOW.", 5)

	local quotes = pickQuotes(CallService.takeQuotes())
	local totalCalls = 0
	for _, n in Economy.calls do
		totalCalls += n
	end
	local lines = { string.format("Day %d  |  Firm $%d / Target $%d  |  Calls answered: %d", Economy.day, Economy.team,
		Economy.quota(), totalCalls) }
	if Economy.biggestDeal.amount > 0 then
		table.insert(lines, string.format("Biggest deal: %s ($%d)", Economy.biggestDeal.name, Economy.biggestDeal.amount))
	end
	for i, q in quotes do
		table.insert(lines, string.format('%d) %s said to %s: "%s"', i, q.name, q.client, q.text))
	end
	setBoard("CALL ANALYSIS", table.concat(lines, "\n"))

	table.clear(votes)
	voting = #quotes > 0
	Net.Meeting:FireAllClients({ phase = "vote", day = Economy.day, quotes = quotes, team = Economy.team,
		quota = Economy.quota(), calls = totalCalls, biggest = Economy.biggestDeal, time = Config.MEETING_VOTE_TIME })
	countdown(voting and Config.MEETING_VOTE_TIME or 3)
	voting = false

	local winner
	if #quotes > 0 then
		local tally = {}
		for _, idx in votes do
			tally[idx] = (tally[idx] or 0) + 1
		end
		local best, bestN = 1, -1
		for i = 1, #quotes do
			if (tally[i] or 0) > bestN then
				best, bestN = i, tally[i] or 0
			end
		end
		winner = quotes[best]
		for _, p in Players:GetPlayers() do
			if p.DisplayName == winner.name then
				Economy.add(p, Config.VOTE_BONUS, false)
				break
			end
		end
	end

	local met = Economy.team >= Economy.quota()
	Net.Meeting:FireAllClients({ phase = "verdict", met = met, team = Economy.team, quota = Economy.quota(),
		winner = winner, bonus = Config.VOTE_BONUS })
	if met then
		setBoard("TARGET SMASHED!", string.format("$%d of $%d\nFunniest moment: %s\nBonus for EVERYBODY. Back to the phones!",
			Economy.team, Economy.quota(), winner and winner.name or "nobody"), Color3.fromRGB(90, 210, 110))
		NPCGuide.chairman("YES! THAT'S what I'm talking about! Bonus for EVERYBODY!", 6)
		for _, p in Players:GetPlayers() do
			Economy.add(p, Config.TARGET_BONUS, false)
		end
	else
		setBoard("YOU'RE FIRED!", string.format("Target missed by $%d\n$%d of $%d", Economy.quota() - Economy.team,
			Economy.team, Economy.quota()), Color3.fromRGB(200, 30, 30))
		NPCGuide.chairman("Missed the target?! Pack your desks. The shredder is HUNGRY.", 8)
	end
	countdown(Config.MEETING_VERDICT_TIME)
	return met
end

local function fired(daysWorked: number)
	state = "FIRED"
	local fires = {}
	for _, pos in office.conference.fireSpots do
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.Transparency = 1
		p.Size = Vector3.new(1, 1, 1)
		p.Position = pos
		local f = Instance.new("Fire")
		f.Size = 10
		f.Heat = 12
		f.Parent = p
		p.Parent = office.folder
		table.insert(fires, p)
	end
	local rows = {}
	for p, earned in Economy.earned do
		table.insert(rows, { name = p.DisplayName, earned = earned })
	end
	for _, p in Players:GetPlayers() do
		if not Economy.earned[p] then
			table.insert(rows, { name = p.DisplayName, earned = 0 })
		end
	end
	table.sort(rows, function(a, b)
		return a.earned > b.earned
	end)
	local top = rows[1] and rows[1].earned or 0
	for _, r in rows do
		r.days = daysWorked
		r.avg = math.floor(r.earned / math.max(daysWorked, 1))
		r.behind = top - r.earned
	end
	Net.Report:FireAllClients({ days = daysWorked, haul = Economy.haul, rows = rows })
	countdown(Config.FIRED_TIME)
	for _, f in fires do
		f:Destroy()
	end
	setBoard("CALL ANALYSIS", "")
end

function GameLoop.run(o)
	office = o
	Net.Vote.OnServerEvent:Connect(function(player, idx)
		if voting and type(idx) == "number" and idx >= 1 and idx <= 3 then
			votes[player] = math.floor(idx)
		end
	end)
	Players.PlayerAdded:Connect(function(p)
		task.wait(2)
		Economy.sendPersonal(p)
	end)
	task.spawn(function()
		while true do
			state = "WAITING"
			while #Players:GetPlayers() == 0 do
				task.wait(1)
			end
			countdown(Config.INTERMISSION)
			while true do
				Economy.startDay()
				CallService.startDay()
				state = "DAY"
				NPCGuide.chairman(HYPE[math.random(#HYPE)], 6)
				countdown(Config.DAY_LENGTH, function(t)
					if t == 60 then
						Net.Toast:FireAllClients("1 MINUTE until the boss meeting!")
					end
				end)
				CallService.stopAll()
				if #Players:GetPlayers() == 0 then
					break
				end
				if not meeting() then
					fired(Economy.day)
					break
				end
				Economy.day += 1
				teleportAll({ office.lobby })
			end
			Economy.resetRun()
			teleportAll({ office.lobby })
		end
	end)
	task.spawn(function() -- keep money on screen fresh between ticks
		while true do
			task.wait(5)
			broadcast()
		end
	end)
end

return GameLoop
