-- Phone app: the call itself. Interest meter + mood, client card, voice waveform, transcript,
-- type box, Hang Up, speaker and mic buttons.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Client = script.Parent.Parent
local UI = require(Client:WaitForChild("UI"))
local Window = require(Client:WaitForChild("Window"))
local Desktop = require(Client:WaitForChild("Desktop"))
local Voice = require(Client:WaitForChild("Voice"))
local Net = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Net"))

local PhoneApp = { call = nil }

local win, refs
local MOOD_COLORS = {
	HOSTILE = UI.colors.red,
	SKEPTICAL = UI.colors.orange,
	CURIOUS = UI.colors.yellow,
	HOOKED = UI.colors.green,
}

local function addBubble(line)
	if not refs then
		return
	end
	local mine = line.who == "player"
	local holder = UI.new("Frame", { Size = UDim2.new(1, -8, 0, 0), AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1, LayoutOrder = #refs.list:GetChildren(), Parent = refs.list })
	local bubble = UI.new("Frame", {
		Size = UDim2.new(0.8, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y,
		Position = mine and UDim2.fromScale(0.2, 0) or UDim2.fromScale(0, 0),
		BackgroundColor3 = mine and Color3.fromRGB(120, 50, 20) or Color3.fromRGB(25, 60, 140), Parent = holder,
	})
	UI.corner(bubble, 8)
	UI.pad(bubble, 8)
	UI.new("UIListLayout", { Parent = bubble })
	UI.text(bubble, line.name, { Size = UDim2.new(1, 0, 0, 20), TextScaled = false, TextSize = 18,
		TextXAlignment = mine and Enum.TextXAlignment.Right or Enum.TextXAlignment.Left,
		TextColor3 = mine and UI.colors.orange or Color3.fromRGB(150, 200, 255) })
	UI.text(bubble, line.text, { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextScaled = false,
		TextSize = 20, TextWrapped = true, Font = UI.body,
		TextXAlignment = mine and Enum.TextXAlignment.Right or Enum.TextXAlignment.Left })
	task.defer(function()
		refs.list.CanvasPosition = Vector2.new(0, 1e6)
	end)
end

local function setTrust(trust: number, mood: string)
	refs.mood.Text = mood
	refs.mood.TextColor3 = MOOD_COLORS[mood] or UI.colors.text
	refs.pct.Text = trust .. "%"
	refs.bar.Size = UDim2.fromScale(math.clamp(trust / 100, 0.01, 1), 1)
	refs.bar.BackgroundColor3 = MOOD_COLORS[mood] or UI.colors.green
end

local function send(text: string)
	if PhoneApp.call and text:gsub("%s", "") ~= "" and not refs.waiting.Visible then
		Net.Say:FireServer(text)
	end
end

local function build(call)
	win = Window.new(Desktop.host(), "Phone", Color3.fromRGB(40, 170, 80), UDim2.fromOffset(430, 640),
		UDim2.new(1, -450, 0, 12))
	Desktop.trackWindow(win, "Phone", Color3.fromRGB(40, 170, 80))
	local c = win.content
	UI.pad(c, 10)
	refs = {}
	local top = UI.new("Frame", { Size = UDim2.new(1, 0, 0, 70), BackgroundColor3 = UI.colors.bg, Parent = c })
	UI.corner(top)
	UI.text(top, "CLIENT INTEREST", { Size = UDim2.new(0.6, 0, 0.45, 0), Position = UDim2.fromOffset(10, 4),
		TextXAlignment = Enum.TextXAlignment.Left })
	refs.mood = UI.text(top, "", { Size = UDim2.new(0.38, 0, 0.45, 0), Position = UDim2.new(0.6, -8, 0, 4),
		TextXAlignment = Enum.TextXAlignment.Right })
	local barBack = UI.new("Frame", { Size = UDim2.new(0.8, 0, 0, 8), Position = UDim2.new(0, 10, 0.68, 0),
		BackgroundColor3 = Color3.fromRGB(50, 50, 60), BorderSizePixel = 0, Parent = top })
	refs.bar = UI.new("Frame", { Size = UDim2.fromScale(0.25, 1), BorderSizePixel = 0, Parent = barBack })
	refs.pct = UI.text(top, "", { Size = UDim2.new(0.16, 0, 0.36, 0), Position = UDim2.new(0.83, 0, 0.55, 0) })

	local card = UI.new("Frame", { Size = UDim2.new(1, 0, 0, 170), Position = UDim2.fromOffset(0, 78),
		BackgroundColor3 = Color3.fromRGB(70, 120, 125), Parent = c })
	UI.corner(card)
	UI.text(card, call.name:upper(), { Size = UDim2.new(1, -16, 0, 26), Position = UDim2.fromOffset(8, 6) })
	local face = UI.new("Frame", { Size = UDim2.fromOffset(92, 92), Position = UDim2.new(0.5, -46, 0, 36),
		BackgroundColor3 = call.color, Parent = card })
	UI.corner(face, 46)
	UI.new("UIStroke", { Thickness = 3, Color = Color3.fromRGB(20, 20, 20), Parent = face })
	for _, x in { 0.3, 0.7 } do -- doodle face
		local eye = UI.new("Frame", { Size = UDim2.fromOffset(22, 22), Position = UDim2.new(x, -11, 0.3, 0),
			BackgroundColor3 = Color3.new(1, 1, 1), Parent = face })
		UI.corner(eye, 11)
		local pupil = UI.new("Frame", { Size = UDim2.fromOffset(9, 9), Position = UDim2.fromOffset(7, 8),
			BackgroundColor3 = Color3.new(0, 0, 0), Parent = eye })
		UI.corner(pupil, 5)
	end
	local mouth = UI.new("Frame", { Size = UDim2.fromOffset(34, 12), Position = UDim2.new(0.5, -17, 0.68, 0),
		BackgroundColor3 = Color3.fromRGB(60, 10, 10), Parent = face })
	UI.corner(mouth, 6)
	UI.text(card, call.kind, { Size = UDim2.new(1, 0, 0, 16), Position = UDim2.new(0, 0, 0, 130), Font = UI.bold,
		TextColor3 = Color3.fromRGB(220, 240, 240) })
	local wave = UI.new("Frame", { Size = UDim2.new(1, -20, 0, 18), Position = UDim2.new(0, 10, 1, -22),
		BackgroundTransparency = 1, Parent = card })
	UI.new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 3),
		VerticalAlignment = Enum.VerticalAlignment.Bottom, Parent = wave })
	refs.waveBars = {}
	for i = 1, 30 do
		table.insert(refs.waveBars, UI.new("Frame", { Size = UDim2.new(0, 8, 0.2, 0), BorderSizePixel = 0,
			BackgroundColor3 = Color3.fromRGB(30, 60, 200), LayoutOrder = i, Parent = wave }))
	end
	refs.waiting = UI.text(card, "MESSAGE SENT - WAITING", { Size = UDim2.new(1, 0, 0, 20), Position = UDim2.new(0, 0, 1, -44),
		TextColor3 = UI.colors.yellow, Visible = false })

	refs.list = UI.new("ScrollingFrame", { Size = UDim2.new(1, 0, 1, -380), Position = UDim2.fromOffset(0, 256),
		BackgroundColor3 = UI.colors.bg, CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 6, BorderSizePixel = 0, Parent = c })
	UI.pad(refs.list, 6)
	UI.new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder, Parent = refs.list })

	refs.input = UI.new("TextBox", { Size = UDim2.new(1, 0, 0, 40), Position = UDim2.new(0, 0, 1, -116),
		BackgroundColor3 = UI.colors.bg, TextColor3 = UI.colors.text, PlaceholderText = "Talk (mic) or type here, Enter to send",
		Font = UI.body, TextSize = 18, ClearTextOnFocus = false, Text = "", Parent = c })
	UI.corner(refs.input)
	refs.input.FocusLost:Connect(function(enter)
		if enter then
			send(refs.input.Text)
			refs.input.Text = ""
		end
	end)
	UI.button(c, "Hang Up", UI.colors.red, { Size = UDim2.new(0.56, 0, 0, 60), Position = UDim2.new(0, 0, 1, -64) }, function()
		Net.HangUp:FireServer()
	end)
	refs.speaker = UI.button(c, "SPK ON", Color3.fromRGB(40, 150, 70),
		{ Size = UDim2.new(0.2, -4, 0, 60), Position = UDim2.new(0.58, 0, 1, -64) }, function()
			Voice.speakerOn = not Voice.speakerOn
			if not Voice.speakerOn then
				Voice.stop()
			end
			refs.speaker.Text = Voice.speakerOn and "SPK ON" or "SPK OFF"
		end)
	refs.mic = UI.button(c, Voice.micAvailable and "MIC OFF" or "NO MIC", Color3.fromRGB(40, 150, 70),
		{ Size = UDim2.new(0.2, -4, 0, 60), Position = UDim2.new(0.8, 4, 1, -64) }, function()
			local on = Voice.setMic(not Voice.micOn)
			refs.mic.Text = on and "MIC ON" or (Voice.micAvailable and "MIC OFF" or "NO MIC")
			refs.mic.BackgroundColor3 = on and UI.colors.red or Color3.fromRGB(40, 150, 70)
		end)

	-- waveform: bounces while the client talks or thinks
	refs.waveConn = RunService.RenderStepped:Connect(function()
		local active = Voice.isSpeaking() or refs.waiting.Visible
		local t = os.clock()
		for i, b in refs.waveBars do
			local h = active and (0.25 + 0.75 * math.abs(math.sin(t * 9 + i * 0.7))) or 0.12
			b.Size = UDim2.new(0, 8, h, 0)
		end
	end)
	win.onClose = (function(prev)
		return function()
			if refs and refs.waveConn then
				refs.waveConn:Disconnect()
			end
			if PhoneApp.call then
				Net.HangUp:FireServer()
			end
			refs = nil
			win = nil
			if prev then
				prev()
			end
		end
	end)(win.onClose)
end

function PhoneApp.open(call)
	if win then
		win:close()
	end
	PhoneApp.call = call
	build(call)
	setTrust(call.trust, call.mood)
	for _, line in call.transcript do
		addBubble(line)
	end
	Voice.onTranscript = send
end

function PhoneApp.update(u)
	if not refs or not PhoneApp.call then
		return
	end
	setTrust(u.trust, u.mood)
	refs.waiting.Visible = u.waiting == true
	if u.line then
		addBubble(u.line)
		if u.line.who == "client" then
			Voice.speak(u.line.text, PhoneApp.call.voice, PhoneApp.call.pitch, PhoneApp.call.speed)
		end
	end
end

function PhoneApp.closed(reason: string)
	PhoneApp.call = nil
	Voice.stop()
	Voice.setMic(false)
	if refs then
		refs.waiting.Visible = false
		addBubble({ who = "client", name = "SYSTEM", text = "Call ended: " .. reason })
		refs.mic.Text = Voice.micAvailable and "MIC OFF" or "NO MIC"
	end
end

function PhoneApp.setInput(text: string)
	if refs then
		refs.input.Text = text
	end
end

return PhoneApp
