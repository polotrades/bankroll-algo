-- Script app: optional pitch lines for the current client. Click a line to drop it in the Phone's type box,
-- or just read it out loud. Improvising is always allowed.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Client = script.Parent.Parent
local UI = require(Client:WaitForChild("UI"))
local Window = require(Client:WaitForChild("Window"))
local Desktop = require(Client:WaitForChild("Desktop"))
local PhoneApp = require(script.Parent:WaitForChild("PhoneApp"))
local PitchScripts = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("PitchScripts"))

local ScriptApp = {}
local win

function ScriptApp.open()
	if win and not win.closed then
		win:setMinimized(false)
		return
	end
	local kind = PhoneApp.call and PhoneApp.call.kind or "Anyone"
	win = Window.new(Desktop.host(), "Script: " .. kind, Color3.fromRGB(40, 110, 230), UDim2.fromOffset(460, 520),
		UDim2.fromOffset(260, 330))
	Desktop.trackWindow(win, "Script", Color3.fromRGB(40, 110, 230))
	local list = UI.new("ScrollingFrame", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1,
		AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(), ScrollBarThickness = 6, Parent = win.content })
	UI.pad(list, 10)
	UI.new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder, Parent = list })
	local me = Players.LocalPlayer.DisplayName
	local order = 0
	for i, step in PitchScripts.steps do
		order += 1
		UI.text(list, i .. ". " .. step:upper(), { Size = UDim2.new(1, 0, 0, 26), TextXAlignment = Enum.TextXAlignment.Left,
			TextColor3 = UI.colors.gold, LayoutOrder = order })
		for _, line in PitchScripts.linesFor(kind, step) do
			order += 1
			local text = line:gsub("{me}", me)
			local b = UI.new("TextButton", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y,
				BackgroundColor3 = UI.colors.panel2, TextColor3 = UI.colors.text, Font = UI.body, TextSize = 18,
				TextWrapped = true, TextXAlignment = Enum.TextXAlignment.Left, Text = text, LayoutOrder = order, Parent = list })
			UI.corner(b, 6)
			UI.pad(b, 8)
			b.Activated:Connect(function()
				PhoneApp.setInput(text)
			end)
		end
	end
	UI.text(list, "Scripts are optional. Improvise! Clients react to whatever you actually say.", {
		Size = UDim2.new(1, 0, 0, 40), TextWrapped = true, Font = UI.body, TextColor3 = UI.colors.dim, LayoutOrder = order + 1 })
end

return ScriptApp
