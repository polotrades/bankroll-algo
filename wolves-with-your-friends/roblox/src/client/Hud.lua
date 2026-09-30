-- On-foot HUD: day, firm money vs target, meeting countdown, personal money, and toast popups.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UI = require(script.Parent:WaitForChild("UI"))

local Hud = {}
local gui, day, team, timer, personal, toastHolder

function Hud.init()
	gui = UI.new("ScreenGui", { Name = "Hud", ResetOnSpawn = false, DisplayOrder = 2,
		Parent = Players.LocalPlayer:WaitForChild("PlayerGui") })
	local panel = UI.new("Frame", { Size = UDim2.fromOffset(300, 128), Position = UDim2.new(1, -312, 0, 12),
		BackgroundColor3 = UI.colors.bg, BackgroundTransparency = 0.15, Parent = gui })
	UI.corner(panel, 10)
	UI.pad(panel, 8)
	UI.new("UIListLayout", { Padding = UDim.new(0, 2), Parent = panel })
	day = UI.text(panel, "WAITING FOR BROKERS", { Size = UDim2.new(1, 0, 0, 26), TextColor3 = UI.colors.gold })
	team = UI.text(panel, "", { Size = UDim2.new(1, 0, 0, 26), TextColor3 = UI.colors.yellow })
	timer = UI.text(panel, "", { Size = UDim2.new(1, 0, 0, 26), TextColor3 = UI.colors.red })
	personal = UI.text(panel, "PERSONAL $0", { Size = UDim2.new(1, 0, 0, 26), TextColor3 = UI.colors.green })
	toastHolder = UI.new("Frame", { Size = UDim2.new(0.5, 0, 0, 200), Position = UDim2.fromScale(0.25, 0.08),
		BackgroundTransparency = 1, Parent = gui })
	UI.new("UIListLayout", { Padding = UDim.new(0, 6), HorizontalAlignment = Enum.HorizontalAlignment.Center,
		Parent = toastHolder })
end

function Hud.setStatus(s)
	if s.state == "WAITING" then
		day.Text = "NEW RUN STARTING"
		timer.Text = "Day 1 in " .. UI.clock(s.timeLeft)
	elseif s.state == "DAY" then
		day.Text = "DAY " .. s.day .. " - FLOOR 100"
		timer.Text = "BOSS MEETING IN " .. UI.clock(s.timeLeft)
	else
		day.Text = s.state == "MEETING" and "BOSS MEETING" or "EVERYONE'S FIRED"
		timer.Text = UI.clock(s.timeLeft)
	end
	team.Text = string.format("FIRM %s / %s", UI.money(s.team), UI.money(s.quota))
	team.TextColor3 = s.team >= s.quota and UI.colors.green or UI.colors.yellow
end

function Hud.setPersonal(n: number)
	personal.Text = "PERSONAL " .. UI.money(n)
end

function Hud.toast(text: string)
	local f = UI.new("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundColor3 = UI.colors.gold, Parent = toastHolder })
	UI.corner(f, 10)
	local l = UI.text(f, text, { Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4),
		TextColor3 = UI.colors.dark })
	task.delay(3.5, function()
		TweenService:Create(f, TweenInfo.new(0.4), { BackgroundTransparency = 1 }):Play()
		TweenService:Create(l, TweenInfo.new(0.4), { TextTransparency = 1 }):Play()
		task.wait(0.45)
		f:Destroy()
	end)
end

return Hud
