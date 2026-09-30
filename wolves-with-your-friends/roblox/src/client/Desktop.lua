-- Shark OS: the full-screen desk computer. Boot screen, wallpaper, app icons, taskbar and status bar.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UI = require(script.Parent:WaitForChild("UI"))

local Desktop = {
	onLeave = nil :: (() -> ())?,
}

local player = Players.LocalPlayer
local gui: ScreenGui
local host: Frame
local iconGrid: Frame
local taskbarApps: Frame
local statusLabels = {}
local apps = {}
local personal = 0
local lastStatus
local savedWalk, savedJump

function Desktop.init()
	gui = UI.new("ScreenGui", {
		Name = "SharkOS", ResetOnSpawn = false, IgnoreGuiInset = true, Enabled = false, DisplayOrder = 5,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = player:WaitForChild("PlayerGui"),
	})
	local wall = UI.new("Frame", { Name = "Wallpaper", Size = UDim2.fromScale(1, 1), BorderSizePixel = 0,
		BackgroundColor3 = Color3.new(1, 1, 1), Parent = gui })
	UI.new("UIGradient", {
		Color = ColorSequence.new({
			ColorSequenceKeypoint.new(0, Color3.fromRGB(40, 30, 95)),
			ColorSequenceKeypoint.new(0.55, Color3.fromRGB(200, 90, 110)),
			ColorSequenceKeypoint.new(1, Color3.fromRGB(255, 175, 80)),
		}),
		Rotation = 90, Parent = wall,
	})
	local rng = Random.new(7)
	for i = 0, 26 do -- skyline silhouette along the bottom of the wallpaper
		local h = rng:NextNumber(0.12, 0.42)
		UI.new("Frame", { Size = UDim2.fromScale(0.04, h), Position = UDim2.fromScale(i * 0.038, 0.94 - h),
			BackgroundColor3 = Color3.fromRGB(35, 25, 60), BorderSizePixel = 0, Parent = wall })
	end
	host = UI.new("Frame", { Name = "Windows", Size = UDim2.new(1, 0, 1, -56), BackgroundTransparency = 1, Parent = gui })
	iconGrid = UI.new("Frame", { Name = "Icons", Size = UDim2.new(0, 220, 1, -76), Position = UDim2.fromOffset(16, 16),
		BackgroundTransparency = 1, Parent = host })
	UI.new("UIGridLayout", { CellSize = UDim2.fromOffset(96, 96), CellPadding = UDim2.fromOffset(10, 10),
		FillDirection = Enum.FillDirection.Vertical, Parent = iconGrid })

	-- taskbar
	local bar = UI.new("Frame", { Name = "Taskbar", Size = UDim2.new(1, 0, 0, 56), Position = UDim2.new(0, 0, 1, -56),
		BackgroundColor3 = Color3.fromRGB(22, 24, 34), BorderSizePixel = 0, Parent = gui })
	UI.button(bar, "LEAVE", UI.colors.blue, { Size = UDim2.fromOffset(80, 44), Position = UDim2.fromOffset(6, 6) }, function()
		local fn = Desktop.onLeave
		if fn then
			fn()
		end
	end)
	taskbarApps = UI.new("Frame", { Size = UDim2.new(0.5, 0, 1, -12), Position = UDim2.fromOffset(96, 6),
		BackgroundTransparency = 1, Parent = bar })
	UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6), Parent = taskbarApps })
	local status = UI.new("Frame", { Size = UDim2.new(0, 520, 1, 0), Position = UDim2.new(1, -520, 0, 0),
		BackgroundColor3 = Color3.fromRGB(30, 32, 45), BorderSizePixel = 0, Parent = bar })
	statusLabels.personal = UI.text(status, "", { Size = UDim2.new(0.62, 0, 0.3, 0), Position = UDim2.fromScale(0, 0.04),
		TextColor3 = UI.colors.green, TextXAlignment = Enum.TextXAlignment.Right })
	statusLabels.team = UI.text(status, "", { Size = UDim2.new(0.62, 0, 0.3, 0), Position = UDim2.fromScale(0, 0.35),
		TextColor3 = UI.colors.yellow, TextXAlignment = Enum.TextXAlignment.Right })
	statusLabels.timer = UI.text(status, "", { Size = UDim2.new(0.62, 0, 0.3, 0), Position = UDim2.fromScale(0, 0.66),
		TextColor3 = UI.colors.red, TextXAlignment = Enum.TextXAlignment.Right })
	statusLabels.clock = UI.text(status, "", { Size = UDim2.new(0.34, 0, 0.8, 0), Position = UDim2.fromScale(0.65, 0.1) })
end

function Desktop.registerApp(def)
	-- def = { id, name, color, open = function() }
	apps[def.id] = def
	local icon = UI.new("TextButton", { Name = def.id, BackgroundTransparency = 1, Text = "", Parent = iconGrid })
	local square = UI.new("Frame", { Size = UDim2.fromOffset(62, 62), Position = UDim2.new(0.5, -31, 0, 2),
		BackgroundColor3 = def.color, Parent = icon })
	UI.corner(square, 12)
	UI.text(square, def.name:sub(1, 1), { Size = UDim2.fromScale(0.8, 0.8), Position = UDim2.fromScale(0.1, 0.1) })
	UI.text(icon, def.name, { Size = UDim2.new(1, 0, 0, 22), Position = UDim2.new(0, 0, 1, -24), Font = UI.bold,
		TextStrokeTransparency = 0.4 })
	icon.Activated:Connect(def.open)
end

function Desktop.host(): Frame
	return host
end

-- keeps one taskbar button per open window
function Desktop.trackWindow(win, name: string, color: Color3)
	local b = UI.button(taskbarApps, name, color, { Size = UDim2.fromOffset(120, 44) }, function()
		win:setMinimized(win.frame.Visible)
	end)
	local prev = win.onClose
	win.onClose = function()
		b:Destroy()
		if prev then
			prev()
		end
	end
end

local function bootScreen()
	local boot = UI.new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(12, 10, 14), ZIndex = 1000,
		Parent = gui })
	UI.text(boot, "WOLF & CO.", { Size = UDim2.fromScale(0.5, 0.12), Position = UDim2.fromScale(0.25, 0.36),
		TextColor3 = UI.colors.gold, ZIndex = 1001 })
	UI.text(boot, "SHARK OS", { Size = UDim2.fromScale(0.3, 0.06), Position = UDim2.fromScale(0.35, 0.5),
		TextColor3 = Color3.fromRGB(255, 220, 190), ZIndex = 1001 })
	task.delay(1.1, function()
		local t = TweenService:Create(boot, TweenInfo.new(0.35), { BackgroundTransparency = 1 })
		for _, d in boot:GetDescendants() do
			if d:IsA("TextLabel") then
				TweenService:Create(d, TweenInfo.new(0.35), { TextTransparency = 1 }):Play()
			end
		end
		t:Play()
		t.Completed:Wait()
		boot:Destroy()
	end)
end

function Desktop.open()
	if gui.Enabled then
		return
	end
	gui.Enabled = true
	bootScreen()
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if hum then
		savedWalk, savedJump = hum.WalkSpeed, hum.JumpPower
		hum.WalkSpeed, hum.JumpPower = 0, 0
	end
end

function Desktop.close()
	gui.Enabled = false
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if hum and savedWalk then
		hum.WalkSpeed, hum.JumpPower = savedWalk, savedJump
	end
end

function Desktop.isOpen(): boolean
	return gui.Enabled
end

function Desktop.setPersonal(n: number)
	personal = n
	statusLabels.personal.Text = "PERSONAL " .. UI.money(n)
end

function Desktop.setStatus(s)
	lastStatus = s
	statusLabels.team.Text = string.format("FIRM %s / TARGET %s", UI.money(s.team), UI.money(s.quota))
	statusLabels.team.TextColor3 = s.team >= s.quota and UI.colors.green or UI.colors.yellow
	if s.state == "DAY" then
		statusLabels.timer.Text = "BOSS MEETING IN " .. UI.clock(s.timeLeft)
	else
		statusLabels.timer.Text = s.state
	end
	-- in-game clock runs 9:00 AM -> 5:00 PM over the workday
	local frac = s.state == "DAY" and (1 - s.timeLeft / 600) or 1
	local minutes = 9 * 60 + math.floor(frac * 8 * 60)
	local h = minutes // 60
	statusLabels.clock.Text = string.format("%d:%02d %s\nDay %d", (h - 1) % 12 + 1, minutes % 60, h < 12 and "AM" or "PM", s.day)
	Desktop.setPersonal(personal)
end

function Desktop.lastStatus()
	return lastStatus
end

-- big green "+$250" that floats up the screen
function Desktop.popMoney(amount: number)
	local target = gui.Enabled and gui or player.PlayerGui:FindFirstChild("Hud")
	if not target then
		return
	end
	local l = UI.text(target, "+" .. UI.money(amount), { Size = UDim2.fromScale(0.4, 0.2),
		Position = UDim2.fromScale(0.3, 0.35), TextColor3 = UI.colors.green, TextStrokeTransparency = 0,
		TextStrokeColor3 = Color3.fromRGB(10, 60, 20), ZIndex = 2000, Rotation = -6 })
	local t = TweenService:Create(l, TweenInfo.new(1.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
		{ Position = UDim2.fromScale(0.3, 0.12), TextTransparency = 1, TextStrokeTransparency = 1 })
	t:Play()
	t.Completed:Connect(function()
		l:Destroy()
	end)
end

return Desktop
