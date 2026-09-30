-- Deal apps (Account Opener, TradeLink, Penny Stock Order): type what the client said, press Verify, get paid.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Client = script.Parent.Parent
local UI = require(Client:WaitForChild("UI"))
local Window = require(Client:WaitForChild("Window"))
local Desktop = require(Client:WaitForChild("Desktop"))
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared:WaitForChild("Net"))
local Deals = require(Shared:WaitForChild("Deals"))

local DealApp = {}
local open: { [string]: any } = {}

function DealApp.open(dealId: string)
	local deal = Deals.byId[dealId]
	if open[dealId] then
		open[dealId].win:setMinimized(false)
		return
	end
	local n = 0
	for _ in open do
		n += 1
	end
	local win = Window.new(Desktop.host(), deal.app, deal.color, UDim2.fromOffset(520, 300),
		UDim2.fromOffset(250 + n * 30, 20 + n * 30))
	Desktop.trackWindow(win, deal.app, deal.color)
	local c = win.content
	UI.pad(c, 14)
	local head = UI.new("Frame", { Size = UDim2.new(1, 0, 0, 64), BackgroundColor3 = Color3.fromRGB(245, 245, 250), Parent = c })
	UI.corner(head)
	local badge = UI.new("Frame", { Size = UDim2.fromOffset(48, 48), Position = UDim2.fromOffset(8, 8),
		BackgroundColor3 = deal.color, Parent = head })
	UI.corner(badge, 10)
	UI.text(badge, "$", { Size = UDim2.fromScale(0.8, 0.8), Position = UDim2.fromScale(0.1, 0.1) })
	UI.text(head, deal.title, { Size = UDim2.new(1, -72, 0, 30), Position = UDim2.fromOffset(66, 4),
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = Color3.fromRGB(20, 30, 60) })
	UI.text(head, deal.subtitle, { Size = UDim2.new(1, -72, 0, 20), Position = UDim2.fromOffset(66, 36), Font = UI.body,
		TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = Color3.fromRGB(90, 90, 110) })
	local msg = UI.text(c, string.format("Enter the information for %s.", UI.money(deal.payout)), {
		Size = UDim2.new(1, 0, 0, 26), Position = UDim2.fromOffset(0, 74), Font = UI.bold, TextColor3 = UI.colors.green,
		TextXAlignment = Enum.TextXAlignment.Left })
	UI.text(c, deal.field, { Size = UDim2.new(1, 0, 0, 24), Position = UDim2.fromOffset(0, 106), Font = UI.bold,
		TextXAlignment = Enum.TextXAlignment.Left })
	local box = UI.new("TextBox", { Size = UDim2.new(1, 0, 0, 44), Position = UDim2.fromOffset(0, 134),
		BackgroundColor3 = Color3.fromRGB(240, 240, 245), TextColor3 = UI.colors.dark, Font = UI.bold, TextSize = 24,
		PlaceholderText = deal.pattern, ClearTextOnFocus = false, Text = "", Parent = c })
	UI.corner(box)
	local verify = UI.button(c, "Verify", Color3.fromRGB(20, 40, 90),
		{ Size = UDim2.fromOffset(170, 48), Position = UDim2.new(1, -170, 0, 188) }, function()
			Net.Verify:FireServer(dealId, box.Text)
		end)
	open[dealId] = { win = win, msg = msg, box = box, verify = verify }
	win.onClose = (function(prev)
		return function()
			open[dealId] = nil
			if prev then
				prev()
			end
		end
	end)(win.onClose)
end

function DealApp.result(dealId: string, ok: boolean, message: string, payout: number?)
	local w = open[dealId]
	if w then
		w.msg.Text = message
		w.msg.TextColor3 = ok and UI.colors.green or UI.colors.red
		if ok then
			w.verify.Text = "Verified"
			w.verify.BackgroundColor3 = Color3.fromRGB(150, 150, 160)
		end
	end
	if ok and payout then
		Desktop.popMoney(payout)
	end
end

function DealApp.resetAll()
	for _, w in open do
		w.verify.Text = "Verify"
		w.verify.BackgroundColor3 = Color3.fromRGB(20, 40, 90)
		w.box.Text = ""
	end
end

return DealApp
