-- Boss meeting overlays: Deal Replay vote, the verdict banner, and the Final Statement ranking.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UI = require(script.Parent:WaitForChild("UI"))
local Net = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Net"))

local Meeting = {}
local gui

local function clear()
	for _, c in gui:GetChildren() do
		c:Destroy()
	end
end

function Meeting.init()
	gui = UI.new("ScreenGui", { Name = "Meeting", ResetOnSpawn = false, DisplayOrder = 10,
		Parent = Players.LocalPlayer:WaitForChild("PlayerGui") })
end

local function vote(m)
	clear()
	local panel = UI.new("Frame", { Size = UDim2.fromOffset(640, 150 + #m.quotes * 90), Position = UDim2.new(0.5, -320, 0.5, -180),
		BackgroundColor3 = Color3.fromRGB(245, 205, 60), Parent = gui })
	UI.corner(panel, 12)
	UI.pad(panel, 14)
	UI.text(panel, "DEAL REPLAY - DAY " .. m.day, { Size = UDim2.new(1, 0, 0, 40), TextColor3 = Color3.fromRGB(40, 20, 10) })
	UI.text(panel, "Vote for the funniest moment! Winner gets " .. UI.money(500) .. ".", { Size = UDim2.new(1, 0, 0, 24),
		Position = UDim2.fromOffset(0, 42), Font = UI.bold, TextColor3 = Color3.fromRGB(80, 50, 10) })
	local buttons = {}
	for i, q in m.quotes do
		local b = UI.button(panel, string.format('%s: "%s"', q.name, q.text), Color3.fromRGB(255, 240, 180),
			{ Size = UDim2.new(1, 0, 0, 80), Position = UDim2.fromOffset(0, 74 + (i - 1) * 88), TextWrapped = true,
				TextColor3 = Color3.fromRGB(40, 20, 10), Font = UI.bold })
		buttons[i] = b
		b.Activated:Connect(function()
			Net.Vote:FireServer(i)
			for j, other in buttons do
				other.BackgroundColor3 = j == i and UI.colors.green or Color3.fromRGB(255, 240, 180)
			end
		end)
	end
	if #m.quotes == 0 then
		UI.text(panel, "Nobody said anything funny today. The Chairman is disappointed.", {
			Size = UDim2.new(1, 0, 0, 40), Position = UDim2.fromOffset(0, 80), TextColor3 = Color3.fromRGB(80, 30, 10) })
	end
end

local function verdict(m)
	clear()
	local good = m.met
	local banner = UI.new("Frame", { Size = UDim2.new(0.7, 0, 0, 220), Position = UDim2.new(0.15, 0, 0.3, 0),
		BackgroundColor3 = good and Color3.fromRGB(60, 190, 90) or Color3.fromRGB(190, 25, 25), Parent = gui })
	UI.corner(banner, 14)
	UI.text(banner, good and "TARGET SMASHED!" or "YOU'RE FIRED!", { Size = UDim2.new(1, 0, 0.5, 0), Position = UDim2.fromScale(0, 0.05) })
	local sub = string.format("%s of %s", UI.money(m.team), UI.money(m.quota))
	if m.winner then
		sub ..= string.format("   |   Funniest: %s (+%s)", m.winner.name, UI.money(m.bonus))
	end
	UI.text(banner, sub, { Size = UDim2.new(1, -20, 0.25, 0), Position = UDim2.new(0, 10, 0.6, 0), Font = UI.bold })
	task.delay(7, function()
		if banner.Parent then
			banner:Destroy()
		end
	end)
end

function Meeting.show(m)
	if m.phase == "vote" then
		vote(m)
	elseif m.phase == "verdict" then
		verdict(m)
	end
end

function Meeting.report(r)
	clear()
	local panel = UI.new("Frame", { Size = UDim2.fromOffset(820, 520), Position = UDim2.new(0.5, -410, 0.5, -260),
		BackgroundColor3 = Color3.fromRGB(255, 244, 214), Parent = gui })
	UI.corner(panel, 12)
	UI.new("UIStroke", { Color = Color3.fromRGB(150, 20, 20), Thickness = 4, Parent = panel })
	UI.pad(panel, 20)
	UI.text(panel, "WOLF & CO. TERMINATION REPORT", { Size = UDim2.new(0.7, 0, 0, 20), Font = UI.bold,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = Color3.fromRGB(150, 60, 40) })
	UI.text(panel, "EVERYONE'S FIRED", { Size = UDim2.new(0.7, 0, 0, 54), Position = UDim2.fromOffset(0, 24),
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = Color3.fromRGB(140, 20, 20) })
	UI.text(panel, string.format("%d DAY%s   %s TEAM HAUL", r.days, r.days == 1 and "" or "S", UI.money(r.haul)), {
		Size = UDim2.new(0.3, 0, 0, 40), Position = UDim2.new(0.7, 0, 0, 24), TextColor3 = Color3.fromRGB(30, 120, 50) })
	local list = UI.new("ScrollingFrame", { Size = UDim2.new(1, 0, 1, -140), Position = UDim2.fromOffset(0, 90),
		BackgroundTransparency = 1, AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(),
		ScrollBarThickness = 6, Parent = panel })
	UI.new("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = list })
	for i, row in r.rows do
		local f = UI.new("Frame", { Size = UDim2.new(1, -10, 0, 70), LayoutOrder = i,
			BackgroundColor3 = i == 1 and Color3.fromRGB(220, 245, 210) or Color3.fromRGB(255, 250, 235), Parent = list })
		UI.corner(f, 8)
		UI.text(f, "#" .. i, { Size = UDim2.new(0.1, 0, 0.7, 0), Position = UDim2.fromScale(0.01, 0.15),
			TextColor3 = i == 1 and Color3.fromRGB(30, 120, 50) or Color3.fromRGB(150, 60, 20) })
		UI.text(f, row.name, { Size = UDim2.new(0.34, 0, 0.5, 0), Position = UDim2.fromScale(0.12, 0.08),
			TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = Color3.fromRGB(60, 30, 20) })
		UI.text(f, i == 1 and "TOP EARNER" or (UI.money(row.behind) .. " BEHIND THE LEADER"), {
			Size = UDim2.new(0.34, 0, 0.3, 0), Position = UDim2.fromScale(0.12, 0.6), Font = UI.bold,
			TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = Color3.fromRGB(150, 80, 40) })
		UI.text(f, UI.money(row.earned), { Size = UDim2.new(0.2, 0, 0.6, 0), Position = UDim2.fromScale(0.5, 0.2),
			TextColor3 = Color3.fromRGB(30, 120, 50) })
		UI.text(f, row.days .. "D", { Size = UDim2.new(0.1, 0, 0.6, 0), Position = UDim2.fromScale(0.72, 0.2),
			TextColor3 = Color3.fromRGB(60, 30, 20) })
		UI.text(f, UI.money(row.avg) .. "/day", { Size = UDim2.new(0.16, 0, 0.6, 0), Position = UDim2.fromScale(0.83, 0.2),
			TextColor3 = Color3.fromRGB(60, 30, 20) })
	end
	UI.button(panel, "BACK TO THE LOBBY", UI.colors.red, { Size = UDim2.fromOffset(260, 40), Position = UDim2.new(0.5, -130, 1, -40) },
		clear)
	task.delay(20, function()
		if panel.Parent then
			clear()
		end
	end)
end

return Meeting
